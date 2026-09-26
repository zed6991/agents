'use strict';

const path = require('path');
const express = require('express');

const auth = require('./auth');
const views = require('./views');
const { renderMarkdown, toPlainText, isSafeUrl } = require('./markdown');
const { xPost, linkedinPost, weeklyRecap } = require('./posts');
const { createBilling } = require('./billing');
const { createMailer } = require('./mailer');
const { escapeHtml } = require('./html');

const RESERVED_SLUGS = new Set(['app', 'api', 'admin', 'login', 'signup', 'logout', 'billing', 'static', 'www', 'new', 'help', 'support']);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TAGS = new Set(['new', 'improved', 'fixed']);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

function str(value, max = 10000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function createApp({ db, config, stripe = null, mailer = null, log = console }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const sessions = auth.createSessionStore(db);
  const billing = createBilling({ db, config, stripe });
  const mail = mailer || createMailer(config.email, { log });
  const loginLimiter = auth.createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });
  const signupLimiter = auth.createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
  const forgotLimiter = auth.createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
  const secureCookies = config.baseUrl.startsWith('https://');
  const baseOrigin = new URL(config.baseUrl).origin;

  const appInfo = {
    appName: config.appName,
    baseUrl: config.baseUrl,
    supportEmail: config.supportEmail,
    plans: config.plans,
    priceMonthlyLabel: config.priceMonthlyLabel,
    priceYearlyLabel: config.priceYearlyLabel,
    hasYearly: Boolean(config.stripe.priceYearly),
    selfChangelogSlug: config.selfChangelogSlug,
  };

  // ---------- Queries ----------
  const q = {
    userByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
    userById: db.prepare('SELECT * FROM users WHERE id = ?'),
    insertUser: db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)'),
    updatePassword: db.prepare('UPDATE users SET password_hash = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
    insertReset: db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)'),
    findReset: db.prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?'),
    useReset: db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?'),
    projectsForUser: db.prepare(`
      SELECT p.*,
        (SELECT COUNT(*) FROM entries e WHERE e.project_id = p.id AND e.status = 'published') AS published_count,
        (SELECT COUNT(*) FROM entries e WHERE e.project_id = p.id AND e.status = 'draft') AS draft_count
      FROM projects p WHERE p.user_id = ? ORDER BY p.created_at`),
    projectCount: db.prepare('SELECT COUNT(*) AS n FROM projects WHERE user_id = ?'),
    projectBySlug: db.prepare('SELECT * FROM projects WHERE slug = ?'),
    publicProject: db.prepare('SELECT p.*, u.plan AS owner_plan FROM projects p JOIN users u ON u.id = p.user_id WHERE p.slug = ?'),
    insertProject: db.prepare('INSERT INTO projects (user_id, name, slug, accent, created_at) VALUES (?, ?, ?, ?, ?)'),
    updateProject: db.prepare('UPDATE projects SET name = ?, website_url = ?, accent = ? WHERE id = ?'),
    deleteProject: db.prepare('DELETE FROM projects WHERE id = ?'),
    // Written at most once an hour per project, to keep widget reads cheap.
    markWidgetSeen: db.prepare(`UPDATE projects SET widget_origin = ?, widget_seen_at = ?
      WHERE id = ? AND (widget_seen_at IS NULL OR widget_seen_at < ? OR widget_origin IS NOT ?)`),
    entriesForProject: db.prepare(`SELECT * FROM entries WHERE project_id = ?
      ORDER BY CASE status WHEN 'draft' THEN 0 ELSE 1 END, COALESCE(published_at, updated_at) DESC, id DESC`),
    publishedEntries: db.prepare(`SELECT * FROM entries WHERE project_id = ? AND status = 'published'
      ORDER BY published_at DESC, id DESC LIMIT ?`),
    publishedSince: db.prepare(`SELECT * FROM entries WHERE project_id = ? AND status = 'published' AND published_at >= ?
      ORDER BY published_at ASC, id ASC`),
    entry: db.prepare('SELECT * FROM entries WHERE id = ? AND project_id = ?'),
    insertEntry: db.prepare(`INSERT INTO entries (project_id, title, body, tag, status, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    updateEntry: db.prepare('UPDATE entries SET title = ?, body = ?, tag = ?, status = ?, published_at = ?, updated_at = ? WHERE id = ?'),
    deleteEntry: db.prepare('DELETE FROM entries WHERE id = ?'),
  };

  // ---------- Middleware ----------
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; form-action 'self' https://checkout.stripe.com https://billing.stripe.com; frame-ancestors 'none'; base-uri 'none'",
      'X-Frame-Options': 'DENY',
    });
    if (secureCookies) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });

  // Stripe needs the raw body to verify the signature, so this route comes
  // before the form parser.
  app.post('/stripe/webhook', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    if (!billing.enabled || !config.stripe.webhookSecret) return res.status(503).send('Billing not configured');
    try {
      const outcome = await billing.handleWebhook(req.body, req.get('stripe-signature'));
      res.json({ received: true, outcome });
    } catch (err) {
      const isSignature = err && err.type === 'StripeSignatureVerificationError';
      if (!isSignature) log.error('[stripe] webhook failed', err);
      res.status(isSignature ? 400 : 500).send(isSignature ? 'Invalid signature' : 'Webhook handler failed');
    }
  });

  app.use(express.urlencoded({ extended: false, limit: '64kb' }));

  app.use(
    express.static(path.join(__dirname, '..', 'public'), {
      maxAge: config.isProduction ? '1h' : 0,
      setHeaders(res, file) {
        if (file.endsWith('widget.js')) {
          res.set('Access-Control-Allow-Origin', '*');
          res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        }
      },
    })
  );

  // Session loading.
  app.use((req, res, next) => {
    const token = auth.parseCookies(req.headers.cookie)[auth.SESSION_COOKIE];
    const session = sessions.lookup(token);
    req.session = session;
    req.user = session ? session.user : null;
    next();
  });

  // Cross-site request protection: every POST must come from our own origin
  // (browsers send Origin on POST), and signed-in POSTs must carry the
  // session's CSRF token.
  app.use((req, res, next) => {
    if (req.method !== 'POST' || req.path === '/stripe/webhook') return next();
    const origin = req.get('origin');
    if (origin && origin !== baseOrigin) return res.status(403).send('Cross-origin request blocked');
    if (req.session && req.body && req.body._csrf !== req.session.csrfToken) {
      return res.status(403).send('Your session expired. Go back, refresh the page and try again.');
    }
    next();
  });

  const ctx = (req) => ({ app: appInfo, user: req.user, csrf: req.session ? req.session.csrfToken : '' });
  const send = (res, page, status = 200) => res.status(status).type('html').send(String(page));

  const requireUser = (req, res, next) => {
    if (!req.user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
    next();
  };

  const loadOwnProject = (req, res, next) => {
    const project = q.projectBySlug.get(req.params.slug);
    if (!project || project.user_id !== req.user.id) {
      return send(res, views.messagePage(ctx(req), { title: 'Not found', message: 'That project does not exist.' }), 404);
    }
    req.project = project;
    next();
  };

  const loadOwnEntry = (req, res, next) => {
    const entry = q.entry.get(Number(req.params.id), req.project.id);
    if (!entry) return send(res, views.messagePage(ctx(req), { title: 'Not found', message: 'That update does not exist.' }), 404);
    req.entry = entry;
    next();
  };

  function startSession(res, userId) {
    const token = sessions.create(userId);
    res.set('Set-Cookie', auth.sessionCookie(token, { secure: secureCookies }));
  }

  function safeNext(value) {
    return typeof value === 'string' && /^\/app(\/|$|\?)/.test(value) ? value : '/app';
  }

  const entryUrl = (project, entry) => `${config.baseUrl}/c/${project.slug}/${entry.id}`;

  // ---------- Public pages ----------
  app.get('/', (req, res) => send(res, views.landingPage(ctx(req))));
  app.get('/terms', (req, res) => send(res, views.legalPage(ctx(req), { kind: 'terms' })));
  app.get('/privacy', (req, res) => send(res, views.legalPage(ctx(req), { kind: 'privacy' })));
  app.get('/healthz', (req, res) => {
    db.prepare('SELECT 1').get();
    res.json({ ok: true });
  });

  // ---------- Auth ----------
  app.get('/signup', (req, res) => {
    if (req.user) return res.redirect('/app');
    send(res, views.authPage(ctx(req), { mode: 'signup', plan: req.query.plan === 'pro' ? 'pro' : '' }));
  });

  app.post('/signup', (req, res) => {
    const email = str(req.body.email, 254).trim().toLowerCase();
    const password = str(req.body.password, 200);
    const plan = req.body.plan === 'pro' ? 'pro' : '';
    const fail = (error, status = 400) => send(res, views.authPage(ctx(req), { mode: 'signup', error, email, plan }), status);

    if (!signupLimiter.hit(req.ip)) return fail('Too many sign-ups from this network. Try again in an hour.', 429);
    if (!EMAIL_PATTERN.test(email)) return fail('Enter a valid email address.');
    if (password.length < 10) return fail('Use a password of at least 10 characters.');
    if (q.userByEmail.get(email)) return fail('An account with that email already exists. Log in instead.');

    const { lastInsertRowid } = q.insertUser.run(email, auth.hashPassword(password), Date.now());
    startSession(res, Number(lastInsertRowid));
    res.redirect(plan === 'pro' ? '/app/billing' : '/app');
  });

  app.get('/login', (req, res) => {
    if (req.user) return res.redirect('/app');
    send(
      res,
      views.authPage(ctx(req), {
        mode: 'login',
        next: safeNext(req.query.next),
        notice: req.query.reset === '1' ? 'Password updated. Log in with your new password.' : '',
      })
    );
  });

  app.post('/login', (req, res) => {
    const email = str(req.body.email, 254).trim().toLowerCase();
    const password = str(req.body.password, 200);
    const next = safeNext(req.body.next);
    const fail = (error, status = 400) => send(res, views.authPage(ctx(req), { mode: 'login', error, email, next }), status);

    if (!loginLimiter.hit(`${req.ip}|${email}`)) return fail('Too many attempts. Wait 15 minutes and try again.', 429);
    const user = q.userByEmail.get(email);
    if (!user || !auth.verifyPassword(password, user.password_hash)) return fail('Email or password is incorrect.', 401);
    startSession(res, user.id);
    res.redirect(next);
  });

  app.post('/logout', (req, res) => {
    if (req.session) sessions.destroy(req.session.tokenHash);
    res.set('Set-Cookie', auth.clearSessionCookie({ secure: secureCookies }));
    res.redirect('/');
  });

  app.get('/forgot', (req, res) => send(res, views.forgotPage(ctx(req), {})));

  app.post('/forgot', async (req, res) => {
    const email = str(req.body.email, 254).trim().toLowerCase();
    if (!forgotLimiter.hit(req.ip)) {
      return send(res, views.forgotPage(ctx(req), { error: 'Too many requests. Try again in an hour.' }), 429);
    }
    const user = EMAIL_PATTERN.test(email) ? q.userByEmail.get(email) : null;
    if (user) {
      const token = auth.randomToken();
      q.insertReset.run(auth.sha256(token), user.id, Date.now() + RESET_TTL_MS);
      const link = `${config.baseUrl}/reset?token=${token}`;
      try {
        await mail.send({
          to: user.email,
          subject: `Reset your ${config.appName} password`,
          text: `Someone asked to reset the password for your ${config.appName} account.\n\nChoose a new password here (the link works for one hour):\n${link}\n\nIf this wasn't you, ignore this email; your password stays the same.`,
        });
      } catch (err) {
        log.error('[mail] reset email failed', err);
      }
    }
    // Same response either way, so the form does not reveal who has an account.
    send(res, views.forgotPage(ctx(req), { sent: true }));
  });

  app.get('/reset', (req, res) => {
    const token = str(req.query.token, 200);
    const valid = token && q.findReset.get(auth.sha256(token), Date.now());
    send(res, views.resetPage(ctx(req), { token, invalid: !valid }), valid ? 200 : 400);
  });

  app.post('/reset', (req, res) => {
    const token = str(req.body.token, 200);
    const password = str(req.body.password, 200);
    const reset = token && q.findReset.get(auth.sha256(token), Date.now());
    if (!reset) return send(res, views.resetPage(ctx(req), { invalid: true }), 400);
    if (password.length < 10) {
      return send(res, views.resetPage(ctx(req), { token, error: 'Use a password of at least 10 characters.' }), 400);
    }
    db.transaction(() => {
      q.useReset.run(Date.now(), reset.token_hash);
      q.updatePassword.run(auth.hashPassword(password), reset.user_id);
      sessions.destroyAllForUser(reset.user_id);
    })();
    res.set('Set-Cookie', auth.clearSessionCookie({ secure: secureCookies }));
    res.redirect('/login?reset=1');
  });

  // ---------- App: projects ----------
  const projectLimit = (user) => (user.plan === 'pro' ? config.plans.pro.projects : config.plans.free.projects);

  function renderDashboard(req, res, { error, form, status = 200 } = {}) {
    const projects = q.projectsForUser.all(req.user.id);
    const canCreate = projects.length < projectLimit(req.user);
    send(res, views.dashboardPage(ctx(req), { projects, error, canCreate, form }), status);
  }

  app.get('/app', requireUser, (req, res) => renderDashboard(req, res));

  app.post('/app/projects', requireUser, (req, res) => {
    const name = str(req.body.name, 60).trim();
    const slug = str(req.body.slug, 40).trim().toLowerCase();
    const form = { name, slug };
    const fail = (error) => renderDashboard(req, res, { error, form, status: 400 });

    if (q.projectCount.get(req.user.id).n >= projectLimit(req.user)) {
      return fail(req.user.plan === 'pro' ? 'You have reached the project limit for Pro.' : 'The Free plan includes one project. Upgrade to Pro for more.');
    }
    if (!name) return fail('Give your project a name.');
    if (slug.length < 3 || !SLUG_PATTERN.test(slug)) {
      return fail('The address must be 3–40 characters: lowercase letters, numbers and single dashes.');
    }
    if (RESERVED_SLUGS.has(slug) || q.projectBySlug.get(slug)) return fail('That address is taken. Try another.');

    q.insertProject.run(req.user.id, name, slug, '#4f46e5', Date.now());
    res.redirect(`/app/p/${slug}`);
  });

  app.get('/app/p/:slug', requireUser, loadOwnProject, (req, res) => {
    const entries = q.entriesForProject.all(req.project.id);
    const notice = { saved: 'Settings saved.', draft: 'Draft saved.', deleted: 'Update deleted.', unpublished: 'Moved back to drafts.' }[req.query.done];
    send(res, views.projectPage(ctx(req), { project: req.project, entries, notice }));
  });

  app.post('/app/p/:slug/settings', requireUser, loadOwnProject, (req, res) => {
    const name = str(req.body.name, 60).trim();
    const website = str(req.body.website_url, 200).trim();
    const accent = str(req.body.accent, 7).trim().toLowerCase();
    const fail = (error) =>
      send(res, views.projectPage(ctx(req), { project: req.project, entries: q.entriesForProject.all(req.project.id), error }), 400);

    if (!name) return fail('The product name cannot be empty.');
    if (website && !isSafeUrl(website)) return fail('The website must start with http:// or https://.');
    if (!/^#[0-9a-f]{6}$/.test(accent)) return fail('Pick an accent colour.');
    q.updateProject.run(name, website || null, accent, req.project.id);
    res.redirect(`/app/p/${req.project.slug}?done=saved`);
  });

  app.post('/app/p/:slug/delete', requireUser, loadOwnProject, (req, res) => {
    q.deleteProject.run(req.project.id);
    res.redirect('/app');
  });

  // ---------- App: entries ----------
  function readEntryForm(body) {
    return {
      title: str(body.title, 120).trim(),
      body: str(body.body, 10000).replace(/\r\n?/g, '\n').trim(),
      tag: TAGS.has(body.tag) ? body.tag : 'new',
    };
  }

  app.get('/app/p/:slug/entries/new', requireUser, loadOwnProject, (req, res) => {
    send(res, views.entryFormPage(ctx(req), { project: req.project, entry: { tag: 'new' } }));
  });

  app.post('/app/p/:slug/entries', requireUser, loadOwnProject, (req, res) => {
    const form = readEntryForm(req.body);
    if (!form.title) {
      return send(res, views.entryFormPage(ctx(req), { project: req.project, entry: form, error: 'Add a title.' }), 400);
    }
    const publish = req.body.intent === 'publish';
    const now = Date.now();
    const { lastInsertRowid } = q.insertEntry.run(
      req.project.id, form.title, form.body, form.tag, publish ? 'published' : 'draft', publish ? now : null, now, now
    );
    res.redirect(
      publish
        ? `/app/p/${req.project.slug}/entries/${lastInsertRowid}/share?published=1`
        : `/app/p/${req.project.slug}?done=draft`
    );
  });

  app.get('/app/p/:slug/entries/:id/edit', requireUser, loadOwnProject, loadOwnEntry, (req, res) => {
    send(res, views.entryFormPage(ctx(req), { project: req.project, entry: req.entry }));
  });

  app.post('/app/p/:slug/entries/:id', requireUser, loadOwnProject, loadOwnEntry, (req, res) => {
    const form = readEntryForm(req.body);
    if (!form.title) {
      return send(res, views.entryFormPage(ctx(req), { project: req.project, entry: { ...req.entry, ...form }, error: 'Add a title.' }), 400);
    }
    const intent = req.body.intent;
    const wasPublished = req.entry.status === 'published';
    let status = req.entry.status;
    if (intent === 'publish') status = 'published';
    if (intent === 'draft' || intent === 'unpublish') status = 'draft';
    const publishedAt = status === 'published' ? req.entry.published_at || Date.now() : null;
    q.updateEntry.run(form.title, form.body, form.tag, status, publishedAt, Date.now(), req.entry.id);

    const base = `/app/p/${req.project.slug}`;
    if (status === 'published' && !wasPublished) return res.redirect(`${base}/entries/${req.entry.id}/share?published=1`);
    if (intent === 'unpublish') return res.redirect(`${base}?done=unpublished`);
    res.redirect(status === 'published' ? `${base}?done=saved` : `${base}?done=draft`);
  });

  app.post('/app/p/:slug/entries/:id/delete', requireUser, loadOwnProject, loadOwnEntry, (req, res) => {
    q.deleteEntry.run(req.entry.id);
    res.redirect(`/app/p/${req.project.slug}?done=deleted`);
  });

  app.get('/app/p/:slug/entries/:id/share', requireUser, loadOwnProject, loadOwnEntry, (req, res) => {
    const { project, entry } = req;
    if (entry.status !== 'published') return res.redirect(`/app/p/${project.slug}/entries/${entry.id}/edit`);
    const url = entryUrl(project, entry);
    send(
      res,
      views.sharePage(ctx(req), {
        project,
        entry,
        entryUrl: url,
        published: req.query.published === '1',
        x: xPost({ entry, url }),
        linkedin: linkedinPost({ entry, projectName: project.name, url }),
      })
    );
  });

  app.get('/app/p/:slug/recap', requireUser, loadOwnProject, (req, res) => {
    const { project } = req;
    const locked = req.user.plan !== 'pro';
    const entries = locked ? [] : q.publishedSince.all(project.id, Date.now() - WEEK_MS);
    const recap = entries.length
      ? weeklyRecap({
          entries,
          projectName: project.name,
          changelogUrl: `${config.baseUrl}/c/${project.slug}`,
          entryUrl: (entry) => entryUrl(project, entry),
        })
      : null;
    send(res, views.recapPage(ctx(req), { project, entries, recap, locked }));
  });

  // ---------- Billing and account ----------
  app.get('/app/billing', requireUser, (req, res) => {
    const checkout = ['success', 'cancelled'].includes(req.query.checkout) ? req.query.checkout : null;
    send(res, views.billingPage(ctx(req), { billingEnabled: billing.enabled, checkout }));
  });

  app.post('/app/billing/checkout', requireUser, async (req, res) => {
    if (!billing.enabled) return send(res, views.billingPage(ctx(req), { billingEnabled: false, error: 'Payments are not configured.' }), 503);
    if (req.user.plan === 'pro') return res.redirect('/app/billing');
    try {
      const url = await billing.createCheckoutSession(req.user, req.body.interval === 'year' ? 'year' : 'month');
      res.redirect(303, url);
    } catch (err) {
      log.error('[stripe] checkout failed', err);
      send(res, views.billingPage(ctx(req), { billingEnabled: true, error: 'Could not start checkout. Please try again in a minute.' }), 502);
    }
  });

  app.post('/app/billing/portal', requireUser, async (req, res) => {
    if (!billing.enabled || !req.user.stripe_customer_id) return res.redirect('/app/billing');
    try {
      res.redirect(303, await billing.createPortalSession(req.user));
    } catch (err) {
      log.error('[stripe] portal failed', err);
      send(res, views.billingPage(ctx(req), { billingEnabled: true, error: 'Could not open the billing portal. Please try again in a minute.' }), 502);
    }
  });

  app.post('/app/account/delete', requireUser, (req, res) => {
    const user = req.user;
    if (user.plan === 'pro' && user.subscription_status !== 'canceled') {
      return send(res, views.billingPage(ctx(req), { billingEnabled: billing.enabled, error: 'Cancel your subscription before deleting your account.' }), 400);
    }
    q.deleteUser.run(user.id);
    res.set('Set-Cookie', auth.clearSessionCookie({ secure: secureCookies }));
    res.redirect('/');
  });

  // ---------- Public changelog, feeds and widget API ----------
  function loadPublicProject(req, res, next) {
    const project = q.publicProject.get(req.params.slug);
    if (!project) return send(res, views.messagePage(ctx(req), { title: 'Not found', message: 'There is no changelog at this address.' }), 404);
    req.publicProject = project;
    next();
  }

  const withHtml = (entry) => ({ ...entry, html: renderMarkdown(entry.body) });

  app.get('/c/:slug', loadPublicProject, (req, res) => {
    const project = req.publicProject;
    const entries = q.publishedEntries.all(project.id, 200).map(withHtml);
    res.set('Cache-Control', 'public, max-age=60');
    send(res, views.changelogPage(ctx(req), { project, entries, showBadge: project.owner_plan !== 'pro' }));
  });

  app.get('/c/:slug/rss.xml', loadPublicProject, (req, res) => {
    const project = req.publicProject;
    const entries = q.publishedEntries.all(project.id, 50);
    const pageUrl = `${config.baseUrl}/c/${project.slug}`;
    const items = entries
      .map(
        (e) => `<item>
<title>${escapeHtml(`[${e.tag}] ${e.title}`)}</title>
<link>${escapeHtml(entryUrl(project, e))}</link>
<guid isPermaLink="true">${escapeHtml(entryUrl(project, e))}</guid>
<pubDate>${new Date(e.published_at).toUTCString()}</pubDate>
<description>${escapeHtml(renderMarkdown(e.body))}</description>
</item>`
      )
      .join('\n');
    res.set('Cache-Control', 'public, max-age=300');
    res.type('application/rss+xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
<title>${escapeHtml(project.name)} changelog</title>
<link>${escapeHtml(pageUrl)}</link>
<description>${escapeHtml(`New features, improvements and fixes in ${project.name}.`)}</description>
${items}
</channel>
</rss>`);
  });

  app.get('/c/:slug/:id', loadPublicProject, (req, res) => {
    const project = req.publicProject;
    const entry = q.entry.get(Number(req.params.id), project.id);
    if (!entry || entry.status !== 'published') {
      return send(res, views.messagePage(ctx(req), { title: 'Not found', message: 'That update does not exist.' }), 404);
    }
    const summary = toPlainText(entry.body).replace(/\s+/g, ' ').slice(0, 200);
    res.set('Cache-Control', 'public, max-age=60');
    send(
      res,
      views.changelogPage(ctx(req), {
        project,
        entries: [withHtml(entry)],
        showBadge: project.owner_plan !== 'pro',
        single: { ...entry, summary },
      })
    );
  });

  app.get('/api/v1/p/:slug/entries', (req, res) => {
    res.set({ 'Access-Control-Allow-Origin': '*', 'Cross-Origin-Resource-Policy': 'cross-origin', 'Cache-Control': 'public, max-age=60' });
    const project = q.publicProject.get(req.params.slug);
    if (!project) return res.status(404).json({ error: 'not_found' });
    // Remember where the widget runs, so the dashboard can confirm the install.
    const origin = req.get('origin');
    if (origin && origin !== baseOrigin && /^https?:\/\/[^/\s]{1,200}$/.test(origin)) {
      const now = Date.now();
      q.markWidgetSeen.run(origin, now, project.id, now - 60 * 60 * 1000, origin);
    }
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const entries = q.publishedEntries.all(project.id, limit).map((e) => ({
      id: e.id,
      title: e.title,
      tag: e.tag,
      html: renderMarkdown(e.body),
      text: toPlainText(e.body),
      published_at: new Date(e.published_at).toISOString(),
      url: entryUrl(project, e),
    }));
    res.json({
      project: {
        name: project.name,
        accent: project.accent,
        url: `${config.baseUrl}/c/${project.slug}`,
        show_badge: project.owner_plan !== 'pro',
        badge_url: `${config.baseUrl}/?ref=widget`,
        app_name: config.appName,
      },
      entries,
    });
  });

  // ---------- Errors ----------
  app.use((req, res) => send(res, views.messagePage(ctx(req), { title: 'Page not found', message: 'We could not find that page.' }), 404));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).send('That was too much text.');
    log.error('[error]', err);
    send(res, views.messagePage(ctx(req), { title: 'Something went wrong', message: 'Please try again. If it keeps happening, email us.' }), 500);
  });

  return app;
}

module.exports = { createApp };
