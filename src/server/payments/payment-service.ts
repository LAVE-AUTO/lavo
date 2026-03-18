/**
 * Payment service: Stripe Connect PaymentIntent creation and transfer.
 * Creates a PaymentIntent with application_fee_amount for the platform commission.
 * The station's stripe_account_id is used as the connected account (destination).
 */
import { stripe } from '@/lib/stripe';
import { NotImplementedError } from '@/lib/errors';

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
 * TODO: Wire real Stripe confirm flow when queue payment UX is defined.
 * Until then, this throws NotImplementedError so the join-queue endpoint
 * returns a 501 instead of silently accepting unpaid entries.
 */
export async function processPayment(
  _params: ProcessPaymentParams
): Promise<ProcessPaymentResult> {
  throw new NotImplementedError('Queue payment is not yet implemented');
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
 * Creates a Stripe Connect PaymentIntent with manual capture.
 * The client's card is authorized (funds blocked) at booking time.
 * The actual capture — which transfers (amount - application_fee) to the station and retains
 * the commission for the platform — is triggered only when the service is marked as completed
 * or when the client is detected as late (no refund in the late case).
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
    capture_method: 'manual',
    application_fee_amount: commissionCents,
    transfer_data: {
      destination: stationStripeAccountId,
    },
    metadata: {
      ...metadata,
      user_id: params.userId,
      station_id: params.stationId,
    },
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
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
 * Captures a previously authorized PaymentIntent.
 * Triggers fund distribution: station receives (amount - application_fee), platform retains the commission.
 * Called when a reservation is marked as completed by the station, or when a client is detected as late
 * (no refund — distribution proceeds as if the service was rendered).
 */
export async function capturePaymentIntent(paymentIntentId: string): Promise<void> {
  await stripe.paymentIntents.capture(paymentIntentId);
}

/**
 * Cancels a Stripe PaymentIntent. Used when a reservation is cancelled while still pending payment.
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<void> {
  await stripe.paymentIntents.cancel(paymentIntentId);
}

/**
 * Issues a Stripe refund for a PaymentIntent.
 * Uses reverse_transfer: false so the refund comes from the platform balance.
 * The station's transfer is handled separately via distributePenalty.
 * If amountCents is provided, issues a partial refund; otherwise refunds the full amount.
 * Returns the Stripe refund ID for tracking.
 */
export async function refundPaymentIntent(
  paymentIntentId: string,
  amountCents?: number
): Promise<string> {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    reverse_transfer: false,
    ...(amountCents !== undefined && { amount: amountCents }),
  });
  return refund.id;
}

/**
 * Distributes the penalty amount between platform and station after a late cancellation.
 * Claws back the platform's share from the station via a Stripe transfer reversal.
 *
 * Mechanics:
 *   - The client refund (reverse_transfer: false) already came from the platform balance.
 *   - This function reverses (penalty - station_share) from the station's transfer.
 *   - Result: platform nets its penalty share, station nets its penalty share.
 *
 * Returns the Stripe transfer reversal ID, or null if no transfer exists or nothing to claw back.
 */
export async function distributePenalty(
  paymentIntentId: string,
  penaltyCents: number,
  stationPenaltyShare: number // fraction [0, 1]
): Promise<string | null> {
  if (penaltyCents <= 0) return null;

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
  if (!chargeId) return null;

  const charge = await stripe.charges.retrieve(chargeId);
  const transferId = typeof charge.transfer === 'string' ? charge.transfer : charge.transfer?.id;
  if (!transferId) return null;

  const stationKeepsCents = Math.round(penaltyCents * stationPenaltyShare);
  const clawbackCents = penaltyCents - stationKeepsCents;
  if (clawbackCents <= 0) return null;

  const reversal = await stripe.transfers.createReversal(transferId, {
    amount: clawbackCents,
  });
  return reversal.id;
}
