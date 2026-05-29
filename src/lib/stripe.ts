/**
 * Stripe client singleton. Requires STRIPE_SECRET_KEY environment variable.
 * Used by payment-service and webhook handler.
 *
 * maxNetworkRetries: 2 — the Stripe SDK retries transient network errors
 * (connection reset, 5xx) up to 2 times with exponential backoff before
 * throwing. This prevents silent failures on capture/refund from a single
 * millisecond of datacenter latency. Stripe uses idempotency keys on the
 * retried requests so there is no double-charge risk.
 */
import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  throw new Error('STRIPE_SECRET_KEY is not set. It is required to initialize the Stripe client.');
}

const globalForStripe = globalThis as unknown as { stripe?: Stripe };

const stripeOptions: Stripe.StripeConfig = {
  apiVersion: '2026-02-25.clover',
  maxNetworkRetries: 2,
};

export const stripe =
  globalForStripe.stripe ??
  new Stripe(secretKey, stripeOptions);

// Keep singleton across hot-reloads in dev AND in production to avoid
// spawning a new instance per worker invocation on cold starts.
globalForStripe.stripe ??= stripe;
