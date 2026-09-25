'use strict';

// All runtime configuration comes from environment variables.
// See .env.example for the full list.

function loadConfig(env = process.env) {
  const isProduction = env.NODE_ENV === 'production';
  const baseUrl = (env.BASE_URL || `http://localhost:${env.PORT || 3000}`).replace(/\/+$/, '');
  const stripeSecretKey = env.STRIPE_SECRET_KEY || '';

  if (stripeSecretKey.startsWith('sk_live_') && env.ALLOW_LIVE_STRIPE !== 'true') {
    throw new Error(
      'Refusing to start with a live Stripe key. Set ALLOW_LIVE_STRIPE=true once you are ready to take real payments.'
    );
  }
  if (isProduction && !env.BASE_URL) {
    throw new Error('BASE_URL must be set in production (for example https://weekship.app).');
  }

  return {
    appName: env.APP_NAME || 'Weekship',
    port: Number(env.PORT || 3000),
    baseUrl,
    isProduction,
    databasePath: env.DATABASE_PATH || './data/weekship.db',
    priceMonthlyLabel: env.PRICE_MONTHLY_LABEL || '9',
    priceYearlyLabel: env.PRICE_YEARLY_LABEL || '90',
    supportEmail: env.SUPPORT_EMAIL || 'support@example.com',
    stripe: {
      secretKey: stripeSecretKey,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
      priceMonthly: env.STRIPE_PRICE_MONTHLY || '',
      priceYearly: env.STRIPE_PRICE_YEARLY || '',
    },
    email: {
      resendApiKey: env.RESEND_API_KEY || '',
      from: env.EMAIL_FROM || '',
    },
    plans: {
      free: { projects: 1 },
      pro: { projects: 5 },
    },
  };
}

module.exports = { loadConfig };
