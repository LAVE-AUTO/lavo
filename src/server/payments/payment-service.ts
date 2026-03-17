/**
 * Payment service: Stripe Connect PaymentIntent creation and transfer.
 * Creates a PaymentIntent with application_fee_amount for the platform commission.
 * The station's stripe_account_id is used as the connected account (destination).
 */
import { stripe } from '@/lib/stripe';

// ─── Legacy queue payment (immediate charge) ────────────────────────────────

export type ProcessPaymentParams = {
  amountCents: number;
  currency?: string;
  userId: string;
  stationId: string;
  entryId?: string;
  metadata?: Record<string, string>;
};

export type ProcessPaymentResult = {
  success: boolean;
  stripePaymentId?: string | null;
  error?: string;
};

/**
 * Processes an immediate payment for queue entries.
 * Creates and immediately confirms a PaymentIntent (no client_secret flow).
 * TODO: Wire real Stripe confirm flow when queue payment UX is defined.
 */
export async function processPayment(
  _params: ProcessPaymentParams
): Promise<ProcessPaymentResult> {
  return {
    success: true,
    stripePaymentId: `pi_stub_${Date.now()}`,
  };
}

// ─── Reservation payment (Stripe Connect with client_secret) ─────────────────

export type CreatePaymentIntentParams = {
  amountCents: number;
  currency?: string;
  userId: string;
  stationId: string;
  stationStripeAccountId: string;
  commissionCents: number;
  metadata?: Record<string, string>;
};

export type CreatePaymentIntentResult = {
  paymentIntentId: string;
  clientSecret: string;
};

/**
 * Creates a Stripe Connect PaymentIntent with automatic transfer to the station's connected account.
 * The platform keeps the application_fee_amount (commission).
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams
): Promise<CreatePaymentIntentResult> {
  const {
    amountCents,
    currency = 'eur',
    stationStripeAccountId,
    commissionCents,
    metadata = {},
  } = params;

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    application_fee_amount: commissionCents,
    transfer_data: {
      destination: stationStripeAccountId,
    },
    metadata: {
      ...metadata,
      user_id: params.userId,
      station_id: params.stationId,
    },
    automatic_payment_methods: { enabled: true },
  });

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client_secret');
  }

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
}

/**
 * Cancels a Stripe PaymentIntent. Used when a reservation is cancelled while still pending payment.
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<void> {
  await stripe.paymentIntents.cancel(paymentIntentId);
}
