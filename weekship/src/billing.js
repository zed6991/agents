'use strict';

// Stripe subscription billing. The webhook is the single source of truth for
// a user's plan: Checkout only starts the flow.

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function createBilling({ db, config, stripe }) {
  const setCustomer = db.prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ? AND stripe_customer_id IS NULL');
  const findByCustomer = db.prepare('SELECT * FROM users WHERE stripe_customer_id = ?');
  const findById = db.prepare('SELECT * FROM users WHERE id = ?');
  const updateSubscription = db.prepare(`
    UPDATE users SET plan = ?, stripe_subscription_id = ?, subscription_status = ?, current_period_end = ?
    WHERE id = ?`);
  const recordEvent = db.prepare('INSERT OR IGNORE INTO stripe_events (id, received_at) VALUES (?, ?)');
  const seenEvent = db.prepare('SELECT 1 FROM stripe_events WHERE id = ?');

  const enabled = Boolean(stripe && config.stripe.secretKey && config.stripe.priceMonthly);

  function priceFor(interval) {
    if (interval === 'year' && config.stripe.priceYearly) return config.stripe.priceYearly;
    return config.stripe.priceMonthly;
  }

  async function createCheckoutSession(user, interval) {
    const params = {
      mode: 'subscription',
      line_items: [{ price: priceFor(interval), quantity: 1 }],
      client_reference_id: String(user.id),
      subscription_data: { metadata: { user_id: String(user.id) } },
      allow_promotion_codes: true,
      success_url: `${config.baseUrl}/app/billing?checkout=success`,
      cancel_url: `${config.baseUrl}/app/billing?checkout=cancelled`,
    };
    if (user.stripe_customer_id) params.customer = user.stripe_customer_id;
    else params.customer_email = user.email;
    const session = await stripe.checkout.sessions.create(params);
    return session.url;
  }

  async function createPortalSession(user) {
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${config.baseUrl}/app/billing`,
    });
    return session.url;
  }

  function userForSubscription(subscription) {
    const byCustomer = subscription.customer && findByCustomer.get(String(subscription.customer));
    if (byCustomer) return byCustomer;
    const userId = subscription.metadata && Number(subscription.metadata.user_id);
    return userId ? findById.get(userId) : null;
  }

  function applySubscription(subscription) {
    const user = userForSubscription(subscription);
    if (!user) return false;
    if (subscription.customer) setCustomer.run(String(subscription.customer), user.id);
    const plan = ACTIVE_STATUSES.has(subscription.status) ? 'pro' : 'free';
    // An old subscription ending must not downgrade a user who has since
    // started a different, active one.
    if (plan === 'free' && user.plan === 'pro' && user.stripe_subscription_id && user.stripe_subscription_id !== subscription.id) {
      return true;
    }
    // current_period_end moved to subscription items in newer API versions.
    const periodEnd =
      subscription.current_period_end ||
      (subscription.items && subscription.items.data && subscription.items.data[0]
        ? subscription.items.data[0].current_period_end
        : null);
    updateSubscription.run(plan, subscription.id, subscription.status, periodEnd || null, user.id);
    return true;
  }

  // Returns a short description of what happened, for logs and tests.
  // An event is recorded only after it was handled, so a failure lets Stripe
  // retry it.
  async function handleWebhook(rawBody, signature) {
    const event = stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
    if (seenEvent.get(event.id)) return 'duplicate';
    const outcome = await processEvent(event);
    recordEvent.run(event.id, Date.now());
    return outcome;
  }

  async function processEvent(event) {
    const object = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = Number(object.client_reference_id);
        if (userId && object.customer) setCustomer.run(String(object.customer), userId);
        if (object.subscription) {
          const id = typeof object.subscription === 'string' ? object.subscription : object.subscription.id;
          applySubscription(await stripe.subscriptions.retrieve(id));
        }
        return 'checkout';
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Events can arrive out of order, so act on the subscription's
        // current state rather than the snapshot inside the event.
        const current = await stripe.subscriptions.retrieve(object.id);
        return applySubscription(current) ? 'subscription' : 'unknown-user';
      }
      default:
        return 'ignored';
    }
  }

  return { enabled, createCheckoutSession, createPortalSession, handleWebhook };
}

module.exports = { createBilling, ACTIVE_STATUSES };
