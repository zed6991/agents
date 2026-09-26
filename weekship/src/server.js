'use strict';

const Stripe = require('stripe');
const { loadConfig } = require('./config');
const { openDatabase } = require('./db');
const { createApp } = require('./app');

const config = loadConfig();
const db = openDatabase(config.databasePath);
const stripe = config.stripe.secretKey ? new Stripe(config.stripe.secretKey) : null;
const app = createApp({ db, config, stripe });

if (!stripe) console.warn('[startup] STRIPE_SECRET_KEY not set: billing is disabled.');
if (stripe && !config.stripe.webhookSecret) console.warn('[startup] STRIPE_WEBHOOK_SECRET not set: plans will not update after checkout.');
if (!config.email.resendApiKey) console.warn('[startup] RESEND_API_KEY not set: password reset links are printed to the log instead of emailed.');

const server = app.listen(config.port, () => {
  console.log(`[startup] ${config.appName} listening on ${config.baseUrl} (port ${config.port})`);
});

// Remove expired sessions once an hour.
const purge = setInterval(() => {
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(Date.now());
}, 60 * 60 * 1000);
purge.unref();

function shutdown(signal) {
  console.log(`[shutdown] ${signal} received, closing`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
