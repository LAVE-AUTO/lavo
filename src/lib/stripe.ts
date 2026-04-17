/**
 * Stripe client singleton. Requires STRIPE_SECRET_KEY environment variable.
 * Used by payment-service and webhook handler.
 */
import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set. It is required to initialize the Stripe client.');
}

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

export const stripe =
  globalForStripe.stripe ??
  new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });

if (process.env.NODE_ENV !== 'production') {
  globalForStripe.stripe = stripe;
}
