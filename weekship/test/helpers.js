'use strict';

const Stripe = require('stripe');
const { openDatabase } = require('../src/db');
const { loadConfig } = require('../src/config');
const { createApp } = require('../src/app');

const WEBHOOK_SECRET = 'whsec_test_secret';

// A Stripe stand-in: real signature verification, fake network calls.
function fakeStripe() {
  const real = new Stripe('sk_test_dummy');
  const calls = { checkout: [], portal: [] };
  const subs = new Map();
  return {
    calls,
    subs,
    webhooks: real.webhooks,
    checkout: {
      sessions: {
        create: async (params) => {
          calls.checkout.push(params);
          return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' };
        },
      },
    },
    billingPortal: {
      sessions: {
        create: async (params) => {
          calls.portal.push(params);
          return { url: 'https://billing.stripe.com/p/session/test_1' };
        },
      },
    },
    subscriptions: {
      retrieve: async (id) => {
        const sub = subs.get(id);
        if (!sub) throw new Error(`No such subscription: ${id}`);
        return sub;
      },
    },
    signedPayload(event) {
      const payload = JSON.stringify(event);
      const header = real.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
      return { payload, header };
    },
  };
}

async function startTestServer({ env = {}, withStripe = true } = {}) {
  const config = loadConfig({
    BASE_URL: 'http://127.0.0.1',
    STRIPE_SECRET_KEY: withStripe ? 'sk_test_dummy' : '',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_MONTHLY: 'price_month',
    STRIPE_PRICE_YEARLY: 'price_year',
    ...env,
  });
  const db = openDatabase(':memory:');
  const stripe = withStripe ? fakeStripe() : null;
  const mails = [];
  const mailer = { send: async (m) => { mails.push(m); return { delivered: true }; } };
  const quiet = { info() {}, warn() {}, error() {} };
  const app = createApp({ db, config, stripe, mailer, log: quiet });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    db,
    stripe,
    mails,
    close: () => new Promise((resolve) => server.close(() => { db.close(); resolve(); })),
  };
}

// A cookie-keeping client that does not follow redirects.
function client(base) {
  let cookie = '';
  async function request(method, path, form, headers = {}) {
    const init = { method, redirect: 'manual', headers: { ...headers } };
    if (cookie) init.headers.cookie = cookie;
    if (form) {
      init.body = new URLSearchParams(form).toString();
      init.headers['content-type'] = 'application/x-www-form-urlencoded';
    }
    const res = await fetch(base + path, init);
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const pair = setCookie.split(';')[0];
      cookie = pair.endsWith('=') ? '' : pair;
    }
    const text = await res.text();
    return { status: res.status, location: res.headers.get('location'), headers: res.headers, text };
  }
  return {
    get: (path, headers) => request('GET', path, null, headers),
    post: (path, form, headers) => request('POST', path, form, headers),
    get cookie() { return cookie; },
    async csrf(path = '/app') {
      const res = await request('GET', path);
      const match = res.text.match(/name="_csrf" value="([^"]+)"/);
      return match ? match[1] : '';
    },
  };
}

async function signUp(base, email = 'maker@example.com', password = 'correct horse battery') {
  const c = client(base);
  const res = await c.post('/signup', { email, password });
  if (res.status !== 302) throw new Error(`signup failed: ${res.status} ${res.text.slice(0, 200)}`);
  return c;
}

async function createProject(c, name = 'Acme', slug = 'acme') {
  const _csrf = await c.csrf();
  return c.post('/app/projects', { _csrf, name, slug });
}

module.exports = { startTestServer, client, signUp, createProject, WEBHOOK_SECRET };
