# Weekship

Write a product update once. Weekship publishes it to:

1. **A hosted changelog page** with a permalink per update, RSS and a JSON API.
2. **An in-app "What's new" widget**: one `<script>` tag, an unread dot, Shadow DOM so it never clashes with the host page's CSS.
3. **Ready-to-post drafts for X and LinkedIn**, counted the way X counts (links = 23, emoji = 2), plus a weekly recap thread on Pro.

Free: 1 project with a "Powered by Weekship" badge. Pro ($9/month or $90/year): up to 5 projects, no badge, weekly recap.

## Stack

- Node.js 22, Express 4, server-rendered HTML (no build step)
- SQLite via better-sqlite3 (one file on a persistent volume)
- Stripe Checkout + Customer Portal + webhooks for subscriptions
- Resend for password-reset email (optional; links are logged when it is not set)
- Tests: Node's built-in test runner, 37 tests, no extra dependencies

## Run locally

```bash
npm install
cp .env.example .env        # optional; everything has a local default
npm run dev                 # http://localhost:3000
npm test
```

Without Stripe keys the app runs normally and the billing page says payments are not configured.

### Try payments in test mode

1. Put your Stripe **test** secret key and two test price IDs in `.env`.
2. Forward webhooks: `stripe listen --forward-to localhost:3000/stripe/webhook` and put the `whsec_...` it prints in `STRIPE_WEBHOOK_SECRET`.
3. Upgrade from `/app/billing` with card `4242 4242 4242 4242`, any future date, any CVC.

The server refuses to start with an `sk_live_` key unless `ALLOW_LIVE_STRIPE=true`.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `BASE_URL` | production | Public URL, e.g. `https://weekship.app`. Used in links, feeds and the widget snippet. |
| `DATABASE_PATH` | no | SQLite file (default `./data/weekship.db`). |
| `PORT` | no | Default 3000 (8080 in the Docker image). |
| `STRIPE_SECRET_KEY` | for billing | `sk_test_...` until you go live. |
| `STRIPE_WEBHOOK_SECRET` | for billing | Signing secret of the webhook endpoint. |
| `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | for billing | Price IDs of the Pro plan. Yearly is optional. |
| `PRICE_MONTHLY_LABEL` / `PRICE_YEARLY_LABEL` | no | Prices shown on the site (default 9 / 90). Keep in sync with Stripe. |
| `ALLOW_LIVE_STRIPE` | no | Must be `true` to use an `sk_live_` key. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Password reset email. |
| `SUPPORT_EMAIL` | yes | Shown in the footer and legal pages. |
| `SELF_CHANGELOG_SLUG` | no | Your own Weekship project; its widget appears on the landing page. |
| `APP_NAME` | no | Rename the product without touching code. |

## Deploy (Fly.io)

`Dockerfile` and `fly.toml` are ready. Step-by-step instructions are in [LAUNCH.md](LAUNCH.md). Stripe webhook events to enable: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.

## Layout

```
src/
  server.js    entry point: config, database, Stripe client, HTTP server
  app.js       routes and middleware (auth, CSRF, plans, public pages, API)
  views.js     HTML pages (tagged-template rendering with auto-escaping)
  posts.js     X / LinkedIn / weekly-recap drafts, X character counting
  markdown.js  small, safe Markdown subset
  billing.js   Stripe Checkout, Portal and webhook handling
  auth.js      scrypt passwords, sessions, rate limiting
  db.js        SQLite schema and migrations
public/
  widget.js    the embeddable widget (no dependencies)
  app.js       copy buttons and small dashboard enhancements
  style.css
test/          unit and HTTP-level tests
```

## Security notes

- Passwords: scrypt with a random salt. Sessions: random tokens, stored hashed, `HttpOnly; SameSite=Lax` (+ `Secure` on HTTPS).
- Every POST checks the `Origin` header; signed-in POSTs also need a per-session CSRF token.
- All HTML output is escaped by default. Update bodies go through a Markdown subset that escapes first and only allows `http(s)` links.
- Strict CSP on the app (no inline scripts), HSTS on HTTPS, rate limits on login, sign-up and password reset.
- Stripe webhooks are signature-checked, idempotent, and re-read the subscription from Stripe so out-of-order events cannot leave a wrong plan.
