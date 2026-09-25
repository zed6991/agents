'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { startTestServer, client, signUp, createProject } = require('./helpers');

let srv;
test.beforeEach(async () => { srv = await startTestServer(); });
test.afterEach(async () => { await srv.close(); });

async function publish(c, slug, fields) {
  const _csrf = await c.csrf(`/app/p/${slug}/entries/new`);
  return c.post(`/app/p/${slug}/entries`, { _csrf, intent: 'publish', tag: 'new', body: '', ...fields });
}

test('landing, legal pages and health check render', async () => {
  const c = client(srv.base);
  const home = await c.get('/');
  assert.equal(home.status, 200);
  assert.match(home.text, /Write the update once/);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
  assert.equal((await c.get('/terms')).status, 200);
  assert.equal((await c.get('/privacy')).status, 200);
  assert.deepEqual(JSON.parse((await c.get('/healthz')).text), { ok: true });
  assert.equal((await c.get('/nope')).status, 404);
});

test('landing page can show Weekship’s own changelog widget', async () => {
  await srv.close();
  srv = await startTestServer({ env: { SELF_CHANGELOG_SLUG: 'weekship-news' } });
  const home = await client(srv.base).get('/');
  assert.match(home.text, /<script src="\/widget.js" data-project="weekship-news" async><\/script>/);
  assert.match(home.text, /href="\/c\/weekship-news">Changelog/);
});

test('sign up, log out, log in', async () => {
  const c = await signUp(srv.base);
  assert.ok(c.cookie.startsWith('ws_session='));
  assert.equal((await c.get('/app')).status, 200);

  const _csrf = await c.csrf();
  const out = await c.post('/logout', { _csrf });
  assert.equal(out.location, '/');
  assert.equal((await c.get('/app')).status, 302);

  const bad = await c.post('/login', { email: 'maker@example.com', password: 'wrong password!' });
  assert.equal(bad.status, 401);
  assert.match(bad.text, /incorrect/);

  const good = await c.post('/login', { email: 'MAKER@example.com', password: 'correct horse battery', next: '/app/billing' });
  assert.equal(good.status, 302);
  assert.equal(good.location, '/app/billing');
});

test('sign up validates input and rejects duplicates', async () => {
  const c = client(srv.base);
  assert.match((await c.post('/signup', { email: 'nope', password: 'longenough1' })).text, /valid email/);
  assert.match((await c.post('/signup', { email: 'a@b.co', password: 'short' })).text, /at least 10/);
  await signUp(srv.base, 'dup@example.com');
  assert.match((await client(srv.base).post('/signup', { email: 'dup@example.com', password: 'longenough1' })).text, /already exists/);
});

test('login redirect ignores off-site next values', async () => {
  await signUp(srv.base, 'n@example.com');
  const res = await client(srv.base).post('/login', { email: 'n@example.com', password: 'correct horse battery', next: 'https://evil.test/app' });
  assert.equal(res.location, '/app');
});

test('POSTs need the CSRF token and a same-origin Origin', async () => {
  const c = await signUp(srv.base);
  const noToken = await c.post('/app/projects', { name: 'Acme', slug: 'acme' });
  assert.equal(noToken.status, 403);
  const _csrf = await c.csrf();
  const crossSite = await c.post('/app/projects', { _csrf, name: 'Acme', slug: 'acme' }, { origin: 'https://evil.test' });
  assert.equal(crossSite.status, 403);
  const ok = await c.post('/app/projects', { _csrf, name: 'Acme', slug: 'acme' });
  assert.equal(ok.location, '/app/p/acme');
});

test('project slugs are validated and unique', async () => {
  const a = await signUp(srv.base, 'a@example.com');
  assert.match((await createProject(a, 'X', 'ab')).text, /3–40 characters/);
  assert.match((await createProject(a, 'X', 'Bad Slug')).text, /3–40 characters/);
  assert.match((await createProject(a, 'X', 'api')).text, /taken/);
  assert.equal((await createProject(a, 'Acme', 'acme')).status, 302);
  const b = await signUp(srv.base, 'b@example.com');
  assert.match((await createProject(b, 'Other', 'acme')).text, /taken/);
});

test('free plan is limited to one project', async () => {
  const c = await signUp(srv.base);
  await createProject(c, 'One', 'one');
  const second = await createProject(c, 'Two', 'two');
  assert.equal(second.status, 400);
  assert.match(second.text, /Free plan includes one project/);
});

test('write, publish, share, and see it on the public page, RSS and API', async () => {
  const c = await signUp(srv.base);
  await createProject(c);

  const draftCsrf = await c.csrf('/app/p/acme/entries/new');
  const draft = await c.post('/app/p/acme/entries', { _csrf: draftCsrf, intent: 'draft', tag: 'fixed', title: 'Secret draft', body: '' });
  assert.equal(draft.location, '/app/p/acme?done=draft');

  const res = await publish(c, 'acme', { title: 'CSV export <b>', body: 'Export **any** report.\n- works with filters', tag: 'new' });
  assert.match(res.location, /^\/app\/p\/acme\/entries\/\d+\/share\?published=1$/);

  const share = await c.get(res.location);
  assert.equal(share.status, 200);
  assert.match(share.text, /Published\. Your changelog and widget are updated/);
  assert.match(share.text, /✨ CSV export &lt;b&gt;/);
  assert.match(share.text, /x\.com\/intent\/post\?text=/);
  assert.match(share.text, /New in Acme: CSV export/);

  const pub = await client(srv.base).get('/c/acme');
  assert.equal(pub.status, 200);
  assert.match(pub.text, /CSV export &lt;b&gt;/);
  assert.match(pub.text, /<strong>any<\/strong>/);
  assert.doesNotMatch(pub.text, /Secret draft/);
  assert.match(pub.text, /Powered by Weekship/);

  const id = res.location.match(/entries\/(\d+)/)[1];
  const single = await client(srv.base).get(`/c/acme/${id}`);
  assert.equal(single.status, 200);
  assert.match(single.text, /og:title" content="CSV export &lt;b&gt; — Acme"/);

  const rss = await client(srv.base).get('/c/acme/rss.xml');
  assert.match(rss.headers.get('content-type'), /rss\+xml/);
  assert.match(rss.text, /<title>\[new\] CSV export &lt;b&gt;<\/title>/);
  assert.doesNotMatch(rss.text, /Secret draft/);

  const api = await client(srv.base).get('/api/v1/p/acme/entries');
  assert.equal(api.headers.get('access-control-allow-origin'), '*');
  const data = JSON.parse(api.text);
  assert.equal(data.project.name, 'Acme');
  assert.equal(data.project.show_badge, true);
  assert.equal(data.entries.length, 1);
  assert.equal(data.entries[0].title, 'CSV export <b>');
  assert.match(data.entries[0].url, new RegExp(`/c/acme/${id}$`));

  assert.equal((await client(srv.base).get('/api/v1/p/missing/entries')).status, 404);
  assert.equal((await client(srv.base).get('/c/missing')).status, 404);
});

test('drafts are not public and unpublishing hides an update', async () => {
  const c = await signUp(srv.base);
  await createProject(c);
  const res = await publish(c, 'acme', { title: 'Going away' });
  const id = res.location.match(/entries\/(\d+)/)[1];
  const _csrf = await c.csrf(`/app/p/acme/entries/${id}/edit`);
  const un = await c.post(`/app/p/acme/entries/${id}`, { _csrf, intent: 'unpublish', title: 'Going away', tag: 'new', body: '' });
  assert.equal(un.location, '/app/p/acme?done=unpublished');
  assert.equal((await client(srv.base).get(`/c/acme/${id}`)).status, 404);
  assert.equal(JSON.parse((await client(srv.base).get('/api/v1/p/acme/entries')).text).entries.length, 0);
  // Sharing a draft sends you to the editor.
  assert.equal((await c.get(`/app/p/acme/entries/${id}/share`)).location, `/app/p/acme/entries/${id}/edit`);
});

test('editing keeps the original publish date and deleting removes the update', async () => {
  const c = await signUp(srv.base);
  await createProject(c);
  const res = await publish(c, 'acme', { title: 'First' });
  const id = Number(res.location.match(/entries\/(\d+)/)[1]);
  const before = srv.db.prepare('SELECT published_at FROM entries WHERE id = ?').get(id).published_at;
  let _csrf = await c.csrf(`/app/p/acme/entries/${id}/edit`);
  const edit = await c.post(`/app/p/acme/entries/${id}`, { _csrf, intent: 'publish', title: 'First, edited', tag: 'improved', body: 'More' });
  assert.equal(edit.location, '/app/p/acme?done=saved');
  const row = srv.db.prepare('SELECT * FROM entries WHERE id = ?').get(id);
  assert.equal(row.title, 'First, edited');
  assert.equal(row.tag, 'improved');
  assert.equal(row.published_at, before);

  const empty = await c.post(`/app/p/acme/entries/${id}`, { _csrf, intent: 'publish', title: '  ', tag: 'new', body: '' });
  assert.equal(empty.status, 400);

  _csrf = await c.csrf(`/app/p/acme/entries/${id}/edit`);
  const del = await c.post(`/app/p/acme/entries/${id}/delete`, { _csrf });
  assert.equal(del.location, '/app/p/acme?done=deleted');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM entries').get().n, 0);
});

test('users cannot see or change each other’s projects', async () => {
  const owner = await signUp(srv.base, 'owner@example.com');
  await createProject(owner);
  const res = await publish(owner, 'acme', { title: 'Mine' });
  const id = res.location.match(/entries\/(\d+)/)[1];

  const intruder = await signUp(srv.base, 'intruder@example.com');
  assert.equal((await intruder.get('/app/p/acme')).status, 404);
  assert.equal((await intruder.get(`/app/p/acme/entries/${id}/edit`)).status, 404);
  const _csrf = await intruder.csrf();
  assert.equal((await intruder.post(`/app/p/acme/entries/${id}/delete`, { _csrf })).status, 404);
  assert.equal((await intruder.post('/app/p/acme/delete', { _csrf })).status, 404);
  assert.equal((await intruder.post('/app/p/acme/settings', { _csrf, name: 'Hacked', accent: '#000000' })).status, 404);
  assert.equal(srv.db.prepare('SELECT name FROM projects').get().name, 'Acme');
});

test('project settings validate URL and colour; delete removes everything', async () => {
  const c = await signUp(srv.base);
  await createProject(c);
  let _csrf = await c.csrf('/app/p/acme');
  assert.match((await c.post('/app/p/acme/settings', { _csrf, name: 'Acme', website_url: 'javascript:alert(1)', accent: '#112233' })).text, /http:\/\/ or https:\/\//);
  assert.match((await c.post('/app/p/acme/settings', { _csrf, name: 'Acme', website_url: '', accent: 'red' })).text, /accent colour/);
  const ok = await c.post('/app/p/acme/settings', { _csrf, name: 'Acme 2', website_url: 'https://acme.test', accent: '#112233' });
  assert.equal(ok.location, '/app/p/acme?done=saved');
  const pub = await client(srv.base).get('/c/acme');
  assert.match(pub.text, /--accent:#112233/);
  assert.match(pub.text, /href="https:\/\/acme.test"/);

  await publish(c, 'acme', { title: 'Soon gone' });
  _csrf = await c.csrf('/app/p/acme');
  assert.equal((await c.post('/app/p/acme/delete', { _csrf })).location, '/app');
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM entries').get().n, 0);
  assert.equal((await client(srv.base).get('/c/acme')).status, 404);
});

test('weekly recap is Pro-only and lists this week’s updates', async () => {
  const c = await signUp(srv.base);
  await createProject(c);
  await publish(c, 'acme', { title: 'Dark mode', body: 'Finally.' });
  assert.match((await c.get('/app/p/acme/recap')).text, /Weekly recap is a Pro feature/);

  srv.db.prepare("UPDATE users SET plan = 'pro'").run();
  const recap = await c.get('/app/p/acme/recap');
  assert.match(recap.text, /This week I shipped 1 update to Acme/);
  assert.match(recap.text, /Dark mode/);
});

test('checkout sends the user to Stripe with their id attached', async () => {
  const c = await signUp(srv.base);
  const _csrf = await c.csrf('/app/billing');
  const res = await c.post('/app/billing/checkout', { _csrf, interval: 'year' });
  assert.equal(res.status, 303);
  assert.equal(res.location, 'https://checkout.stripe.com/c/pay/cs_test_1');
  const params = srv.stripe.calls.checkout[0];
  assert.equal(params.mode, 'subscription');
  assert.deepEqual(params.line_items, [{ price: 'price_year', quantity: 1 }]);
  assert.equal(params.customer_email, 'maker@example.com');
  assert.equal(params.client_reference_id, params.subscription_data.metadata.user_id);
});

test('webhooks upgrade and downgrade the plan, and reject bad signatures', async () => {
  const c = await signUp(srv.base);
  await createProject(c);
  const userId = srv.db.prepare('SELECT id FROM users').get().id;
  const post = (event) => {
    const { payload, header } = srv.stripe.signedPayload(event);
    return fetch(`${srv.base}/stripe/webhook`, { method: 'POST', body: payload, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
  };

  const bad = await fetch(`${srv.base}/stripe/webhook`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' } });
  assert.equal(bad.status, 400);

  srv.stripe.subs.set('sub_1', { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { user_id: String(userId) }, items: { data: [{ current_period_end: 1900000000 }] } });
  const checkout = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { client_reference_id: String(userId), customer: 'cus_1', subscription: 'sub_1' } } };
  const res = await post(checkout);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).outcome, 'checkout');
  let user = srv.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(user.plan, 'pro');
  assert.equal(user.stripe_customer_id, 'cus_1');
  assert.equal(user.current_period_end, 1900000000);

  assert.equal((await (await post(checkout)).json()).outcome, 'duplicate');

  // Pro removes the badge and allows more projects.
  assert.doesNotMatch((await client(srv.base).get('/c/acme')).text, /Powered by/);
  assert.equal(JSON.parse((await client(srv.base).get('/api/v1/p/acme/entries')).text).project.show_badge, false);
  assert.equal((await createProject(c, 'Two', 'two')).status, 302);

  // Billing page offers the portal.
  const _csrf = await c.csrf('/app/billing');
  const portal = await c.post('/app/billing/portal', { _csrf });
  assert.equal(portal.location, 'https://billing.stripe.com/p/session/test_1');
  assert.equal(srv.stripe.calls.portal[0].customer, 'cus_1');

  // Cancellation.
  srv.stripe.subs.set('sub_1', { ...srv.stripe.subs.get('sub_1'), status: 'canceled' });
  const del = await post({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1' } } });
  assert.equal((await del.json()).outcome, 'subscription');
  user = srv.db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  assert.equal(user.plan, 'free');
  assert.equal(user.subscription_status, 'canceled');
  assert.match((await client(srv.base).get('/c/acme')).text, /Powered by/);
});

test('a failed webhook is not recorded, so Stripe can retry it', async () => {
  await signUp(srv.base);
  const event = { id: 'evt_retry', type: 'customer.subscription.updated', data: { object: { id: 'sub_missing', customer: 'cus_x' } } };
  const { payload, header } = srv.stripe.signedPayload(event);
  const res = await fetch(`${srv.base}/stripe/webhook`, { method: 'POST', body: payload, headers: { 'content-type': 'application/json', 'stripe-signature': header } });
  assert.equal(res.status, 500);
  assert.equal(srv.db.prepare('SELECT COUNT(*) AS n FROM stripe_events').get().n, 0);
});

test('billing degrades gracefully without Stripe', async () => {
  await srv.close();
  srv = await startTestServer({ withStripe: false });
  const c = await signUp(srv.base);
  assert.match((await c.get('/app/billing')).text, /Payments are not configured/);
  const _csrf = await c.csrf('/app/billing');
  assert.equal((await c.post('/app/billing/checkout', { _csrf })).status, 503);
  assert.equal((await fetch(`${srv.base}/stripe/webhook`, { method: 'POST', body: '{}' })).status, 503);
});

test('password reset flow', async () => {
  await signUp(srv.base, 'forgetful@example.com');
  const c = client(srv.base);
  const unknown = await c.post('/forgot', { email: 'nobody@example.com' });
  assert.match(unknown.text, /If an account exists/);
  assert.equal(srv.mails.length, 0);

  await c.post('/forgot', { email: 'forgetful@example.com' });
  assert.equal(srv.mails.length, 1);
  const link = srv.mails[0].text.match(/(\/reset\?token=\S+)/)[1];
  assert.equal((await c.get(link)).status, 200);
  const token = new URL(link, srv.base).searchParams.get('token');

  assert.match((await c.post('/reset', { token, password: 'short' })).text, /at least 10/);
  const done = await c.post('/reset', { token, password: 'a brand new password' });
  assert.equal(done.location, '/login?reset=1');
  assert.equal((await c.post('/reset', { token, password: 'another new password' })).status, 400, 'token is single-use');

  const login = await client(srv.base).post('/login', { email: 'forgetful@example.com', password: 'a brand new password' });
  assert.equal(login.status, 302);
  assert.equal((await c.get('/reset?token=garbage')).status, 400);
});

test('login is rate limited', async () => {
  await signUp(srv.base, 'target@example.com');
  const c = client(srv.base);
  let last;
  for (let i = 0; i < 11; i++) last = await c.post('/login', { email: 'target@example.com', password: `guess number ${i}` });
  assert.equal(last.status, 429);
});

test('account deletion removes all data', async () => {
  const c = await signUp(srv.base);
  await createProject(c);
  await publish(c, 'acme', { title: 'x' });
  const _csrf = await c.csrf('/app/billing');
  const res = await c.post('/app/account/delete', { _csrf });
  assert.equal(res.location, '/');
  for (const table of ['users', 'projects', 'entries', 'sessions']) {
    assert.equal(srv.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n, 0, table);
  }
});

test('the dashboard confirms where the widget is installed', async () => {
  const c = await signUp(srv.base);
  await createProject(c);
  assert.match((await c.get('/app/p/acme')).text, /Not detected yet/);
  await fetch(`${srv.base}/api/v1/p/acme/entries`, { headers: { origin: 'https://customer-app.test' } });
  assert.match((await c.get('/app/p/acme')).text, /Widget last seen on <strong>customer-app.test<\/strong>/);
});

test('widget script is served with cross-origin headers', async () => {
  const res = await fetch(`${srv.base}/widget.js`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.match(await res.text(), /data-project/);
});
