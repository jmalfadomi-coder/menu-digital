import { registerAs } from '@nestjs/config';

export default registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  prices: {
    STARTER: process.env.STRIPE_PRICE_STARTER || '',
    PRO: process.env.STRIPE_PRICE_PRO || '',
    ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE || '',
  },
  successUrl: process.env.STRIPE_SUCCESS_URL || 'http://localhost:3000/billing/success',
  cancelUrl: process.env.STRIPE_CANCEL_URL || 'http://localhost:3000/billing/cancel',
}));
