/**
 * Payment service: Stripe Connect PaymentIntent creation and transfer.
 * Creates a PaymentIntent with application_fee_amount for the platform commission.
 * The station's stripe_account_id is used as the connected account (destination).
 */
import { stripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import { APP_URL } from '@/helpers/constants';
import { ConflictError, NotImplementedError, ValidationError } from '@/lib/errors';

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
  params: ProcessPaymentParams
): Promise<ProcessPaymentResult> {
  void params;
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
 * The actual capture - which transfers (amount - application_fee) to the station and retains
 * the commission for the platform - is triggered only when the service is marked as completed
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

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ValidationError('Invalid payment amount');
  }
  if (!Number.isInteger(commissionCents) || commissionCents < 0 || commissionCents > amountCents) {
    throw new ValidationError('Invalid commission amount');
  }
  const destination = stationStripeAccountId.trim();
  if (!destination.startsWith('acct_')) {
    throw new ValidationError('Invalid connected account');
  }

  const mergedMetadata: Record<string, string> = {
    ...metadata,
    user_id: params.userId,
    station_id: params.stationId,
  };

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency,
      capture_method: 'manual',
      application_fee_amount: commissionCents,
      transfer_data: {
        destination,
      },
      metadata: mergedMetadata,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg.includes('destination account needs to have at least one of the following capabilities') ||
      msg.includes('capabilities.stripe_balance.stripe_transfers')
    ) {
      throw new ConflictError('Station payment account is not fully configured');
    }
    throw e;
  }

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
 * (no refund - distribution proceeds as if the service was rendered).
 * Returns the charge ID and transfer ID so callers can persist them without extra Stripe API calls.
 */
export async function capturePaymentIntent(
  paymentIntentId: string
): Promise<{ chargeId: string | null; transferId: string | null }> {
  const captured = await stripe.paymentIntents.capture(paymentIntentId, {
    expand: ['latest_charge'],
  });

  const charge = typeof captured.latest_charge === 'string'
    ? null
    : captured.latest_charge ?? null;
  const chargeId = charge?.id ?? null;
  const rawTransfer = charge?.transfer as string | Stripe.Transfer | undefined;
  const transferId = typeof rawTransfer === 'string'
    ? rawTransfer
    : rawTransfer?.id ?? null;

  return { chargeId, transferId };
}

/**
 * Cancels a Stripe PaymentIntent. Used when a reservation is cancelled while still pending payment.
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<void> {
  await stripe.paymentIntents.cancel(paymentIntentId);
}

/**
 * Issues a Stripe refund for a PaymentIntent.
 * If reverseTransfer is true, Stripe also reverses the connected-account transfer so the
 * station bears the cost (used when the station has already been paid out).
 * Otherwise the refund comes from the platform balance.
 * If amountCents is provided, issues a partial refund; otherwise refunds the full amount.
 * An optional idempotencyKey prevents double-refunds when the caller retries on timeout.
 * Returns the Stripe refund ID for tracking.
 */
export async function refundPaymentIntent(
  paymentIntentId: string,
  amountCents?: number,
  idempotencyKey?: string,
  reverseTransfer = false,
): Promise<string> {
  const refund = await stripe.refunds.create(
    {
      payment_intent: paymentIntentId,
      reverse_transfer: reverseTransfer,
      ...(amountCents !== undefined && { amount: amountCents }),
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );
  return refund.id;
}

/**
 * Updates the metadata on an existing Stripe PaymentIntent.
 * Used when a reservation is rescheduled without penalty to re-point the PI to the new reservation.
 */
export async function updatePaymentIntentMetadata(
  paymentIntentId: string,
  metadata: Record<string, string>
): Promise<void> {
  await stripe.paymentIntents.update(paymentIntentId, { metadata });
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
 * When preloadedChargeId and/or preloadedTransferId are provided (from capturePaymentIntent),
 * the Stripe retrieve calls are skipped - saving 2 API round-trips per late cancellation.
 *
 * Returns the Stripe transfer reversal ID, or null if no transfer exists or nothing to claw back.
 */
export async function distributePenalty(
  paymentIntentId: string,
  penaltyCents: number,
  stationPenaltyShare: number, // fraction [0, 1]
  idempotencyKey?: string,
  preloadedChargeId?: string,
  preloadedTransferId?: string,
): Promise<string | null> {
  if (penaltyCents <= 0) return null;

  let chargeId = preloadedChargeId ?? null;
  let transferId = preloadedTransferId ?? null;

  // Only fetch from Stripe if not preloaded - avoids 2 extra API calls per late cancel.
  if (!transferId) {
    if (!chargeId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id ?? null;
    }
    if (chargeId) {
      const charge = await stripe.charges.retrieve(chargeId);
      const rawChargeTransfer = charge.transfer as string | Stripe.Transfer | undefined;
      transferId = typeof rawChargeTransfer === 'string' ? rawChargeTransfer : rawChargeTransfer?.id ?? null;
    }
  }
  if (!transferId) return null;

  const stationKeepsCents = Math.round(penaltyCents * stationPenaltyShare);
  const clawbackCents = penaltyCents - stationKeepsCents;
  if (clawbackCents <= 0) return null;

  const reversal = await stripe.transfers.createReversal(
    transferId,
    { amount: clawbackCents },
    idempotencyKey ? { idempotencyKey } : undefined
  );
  return reversal.id;
}

// ─── Tip payment (destination charge, 0% platform fee) ───────────────────────

export type CreateTipPaymentIntentParams = {
  amountCents: number;
  currency: string;
  userId: string;
  stationId: string;
  stationStripeAccountId: string;
  reservationId: string;
  metadata?: Record<string, string>;
};

/**
 * Creates a Stripe PaymentIntent for a client tip.
 * Uses a destination charge (transfer_data.destination) with no application_fee_amount,
 * so 100% of the tip flows directly to the station's connected account.
 * capture_method is 'automatic' - funds are captured immediately on confirmation.
 */
export async function createTipPaymentIntent(
  params: CreateTipPaymentIntentParams
): Promise<CreatePaymentIntentResult> {
  const { amountCents, currency, stationStripeAccountId, metadata = {} } = params;

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ValidationError('Invalid tip amount');
  }
  const destination = stationStripeAccountId.trim();
  if (!destination.startsWith('acct_')) {
    throw new ValidationError('Invalid connected account');
  }

  const mergedMetadata: Record<string, string> = {
    ...metadata,
    user_id: params.userId,
    station_id: params.stationId,
    reservation_id: params.reservationId,
    type: 'tip',
  };

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    capture_method: 'automatic',
    transfer_data: { destination },
    metadata: mergedMetadata,
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

// ─── Stripe Connect onboarding ────────────────────────────────────────────────

/**
 * Creates a Stripe Connect Express account for a station.
 * Returns the new account ID (acct_xxx) to be stored in stations.stripe_account_id.
 */
export async function createStripeConnectAccount(
  email: string,
  stationId: string
): Promise<string> {
  if (!email.trim()) {
    throw new ValidationError('Invalid email for Stripe Connect account');
  }
  if (!stationId.trim()) {
    throw new ValidationError('Invalid station id for Stripe Connect account');
  }
  const account = await stripe.accounts.create({
    type: 'express',
    email,
    metadata: { station_id: stationId },
  });
  return account.id;
}

/**
 * Generates a Stripe Connect onboarding link for a connected account.
 * The station owner uses this URL to complete their Stripe profile and add bank details.
 * locale defaults to 'fr' (always-prefixed i18n routing).
 */
export async function createStripeOnboardingLink(accountId: string, locale = 'fr'): Promise<string> {
  if (!accountId.trim().startsWith('acct_')) {
    throw new ValidationError('Invalid connected account id for onboarding link');
  }
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${APP_URL}/${locale}/station/stripe-refresh`,
    return_url: `${APP_URL}/${locale}/station/stripe-return`,
    type: 'account_onboarding',
  });
  return link.url;
}

/**
 * Returns the Stripe receipt URL for a PaymentIntent when available.
 * Returns null when no charge/receipt exists yet.
 */
export async function getStripeReceiptUrl(paymentIntentId: string): Promise<string | null> {
  const pi = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });

  const latestCharge = pi.latest_charge;
  if (!latestCharge) return null;

  if (typeof latestCharge !== 'string') {
    return latestCharge.receipt_url ?? null;
  }

  const charge = await stripe.charges.retrieve(latestCharge);
  return charge.receipt_url ?? null;
}
