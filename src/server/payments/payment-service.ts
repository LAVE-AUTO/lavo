/**
 * Payment service: Stripe Connect PaymentIntent creation and transfer.
 * Creates a PaymentIntent with application_fee_amount for the platform commission.
 * The station's stripe_account_id is used as the connected account (destination).
 */
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';
import { APP_URL } from '@/helpers/constants';
import { DEFAULT_PLATFORM_CURRENCY } from '@/helpers/server-constants';
import { ConflictError, NotImplementedError, ValidationError } from '@/lib/errors';
import { logFinancialEvent } from './financial-event-logger';

// ─── Stripe error classification ──────────────────────────────────────────────

export type StripeErrorClass =
  | 'network'      // transient — SDK already retried; log and potentially schedule retry
  | 'card_declined' // non-retryable — client must use a different payment method
  | 'invalid_request' // non-retryable — bad parameters, wrong PI state
  | 'unknown';     // catchall

/**
 * Classifies a Stripe error for structured logging and retry decisions.
 * Callers should log the `class` so ops can distinguish "retry later" from
 * "client action required" without reading raw Stripe error strings.
 */
export function classifyStripeError(e: unknown): { class: StripeErrorClass; code: string | null; message: string } {
  if (e instanceof Stripe.errors.StripeConnectionError || e instanceof Stripe.errors.StripeAPIError) {
    return { class: 'network', code: null, message: e.message };
  }
  if (e instanceof Stripe.errors.StripeCardError) {
    return { class: 'card_declined', code: e.code ?? null, message: e.message };
  }
  if (e instanceof Stripe.errors.StripeInvalidRequestError) {
    return { class: 'invalid_request', code: e.code ?? null, message: e.message };
  }
  const message = e instanceof Error ? e.message : String(e);
  return { class: 'unknown', code: null, message };
}

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
  applicationFeeAmountCents: number;
  metadata?: Record<string, string>;
  /**
   * Stripe idempotency key — prevents duplicate PIs when the client retries
   * a failed request before our response arrives. Pass `pi-create:<entryId>`.
   */
  idempotencyKey?: string;
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
    // Default sourced from server-constants so reservations and tips share the same default
    // currency (bug #25). Per-call override still supported.
    currency = DEFAULT_PLATFORM_CURRENCY,
    stationStripeAccountId,
    applicationFeeAmountCents,
    metadata = {},
    idempotencyKey,
  } = params;

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ValidationError('Invalid payment amount');
  }
  if (
    !Number.isInteger(applicationFeeAmountCents) ||
    applicationFeeAmountCents < 0 ||
    applicationFeeAmountCents > amountCents
  ) {
    throw new ValidationError('Invalid application fee amount');
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
    paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency,
        capture_method: 'manual',
        application_fee_amount: applicationFeeAmountCents,
        transfer_data: { destination },
        metadata: mergedMetadata,
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
      },
      idempotencyKey ? { idempotencyKey } : undefined
    );
  } catch (e) {
    const err = classifyStripeError(e);
    if (
      err.message.includes('destination account needs to have at least one of the following capabilities') ||
      err.message.includes('capabilities.stripe_balance.stripe_transfers')
    ) {
      throw new ConflictError('Station payment account is not fully configured');
    }
    // The station's connected account does not exist for the current platform key
    // (e.g. test/live mismatch, foreign platform, or deleted account). Surface a clean
    // 409 instead of a raw 500 so the client shows an actionable message rather than crashing.
    if (err.message.includes('No such destination') || err.message.includes('No such account')) {
      throw new ConflictError('Station payment account is not connected. Please reconnect Stripe.');
    }
    throw e;
  }

  if (!paymentIntent.client_secret) {
    throw new Error('Stripe did not return a client_secret');
  }

  logFinancialEvent({
    event: 'PI_CREATED',
    stripePaymentIntentId: paymentIntent.id,
    amountCents,
    currency,
    userId: params.userId,
    stationId: params.stationId,
    meta: { application_fee_amount_cents: applicationFeeAmountCents },
  });

  return {
    paymentIntentId: paymentIntent.id,
    clientSecret: paymentIntent.client_secret,
  };
}

/**
 * Result of a capture attempt.
 * `charged = true`  — funds were captured now, OR the PI was already `succeeded`
 *                     (idempotent re-capture): charge/transfer IDs are valid, proceed
 *                     with refund and penalty distribution as normal.
 * `charged = false` — the PI was already `canceled` before capture (expired PI,
 *                     concurrent cancellation): no funds were moved, callers must
 *                     skip all refund and penalty operations.
 */
export type CaptureResult = {
  chargeId: string | null;
  transferId: string | null;
  charged: boolean;
};

/**
 * Captures a previously authorized PaymentIntent.
 * Triggers fund distribution: station receives (amount - application_fee), platform retains commission.
 * Called on service completion, late cancellation, and no-show detection.
 *
 * Resilient to concurrent state changes:
 *   - `already succeeded` (concurrent webhook): retrieves existing charge/transfer, charged=true.
 *   - `already canceled`  (PI expired or race): returns charged=false so callers skip money movement.
 */
export async function capturePaymentIntent(paymentIntentId: string): Promise<CaptureResult> {
  let pi: Stripe.PaymentIntent;
  try {
    pi = await stripe.paymentIntents.capture(paymentIntentId, { expand: ['latest_charge'] });
  } catch (e) {
    if (
      e instanceof Stripe.errors.StripeInvalidRequestError &&
      e.code === 'payment_intent_unexpected_state'
    ) {
      // PI is either already `succeeded` (idempotent) or `canceled` (abandoned/expired).
      const existing = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['latest_charge'],
      });
      if (existing.status === 'canceled') {
        return { chargeId: null, transferId: null, charged: false };
      }
      // status === 'succeeded': extract existing charge so callers can distribute/refund normally.
      pi = existing;
    } else {
      throw e;
    }
  }

  const charge = typeof pi.latest_charge === 'string' ? null : pi.latest_charge ?? null;
  const chargeId = charge?.id ?? null;
  const rawTransfer = charge?.transfer as string | Stripe.Transfer | undefined;
  const transferId =
    typeof rawTransfer === 'string' ? rawTransfer : rawTransfer?.id ?? null;

  logFinancialEvent({
    event: 'PI_CAPTURED',
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId ?? undefined,
    stripeTransferId: transferId ?? undefined,
  });

  return { chargeId, transferId, charged: true };
}

/**
 * Cancels a Stripe PaymentIntent. Used when a reservation is cancelled while still pending payment.
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<void> {
  await stripe.paymentIntents.cancel(paymentIntentId);
  logFinancialEvent({ event: 'PI_CANCELLED', stripePaymentIntentId: paymentIntentId });
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
  logFinancialEvent({
    event: 'REFUND_ISSUED',
    stripePaymentIntentId: paymentIntentId,
    stripeRefundId: refund.id,
    amountCents,
  });
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
 *   - The refund funds came from the station's original transfer (service not rendered).
 *   - Clawback = stationTransferCents − (penalty × stationPenaltyShare):
 *       station keeps exactly its penalty compensation, everything else goes back to platform.
 *   - Result: platform nets (penalty × platformShare − stripe_fee), station nets its penalty share.
 *
 * When preloadedChargeId and/or preloadedTransferId are provided (from capturePaymentIntent),
 * the Stripe retrieve calls are skipped - saving 2 API round-trips per late cancellation.
 *
 * Returns the Stripe transfer reversal ID, or null if no transfer exists or nothing to claw back.
 */
export async function distributePenalty(
  paymentIntentId: string,
  penaltyCents: number,
  stationTransferCents: number, // the station's original transfer amount (amount_paid − commission)
  stationPenaltyShare: number,  // fraction [0, 1]
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

  // Station keeps only its penalty compensation; everything else is reversed to platform.
  const stationKeepsCents = Math.round(penaltyCents * stationPenaltyShare);
  const clawbackCents = stationTransferCents - stationKeepsCents;
  if (clawbackCents <= 0) return null;

  const reversal = await stripe.transfers.createReversal(
    transferId,
    { amount: clawbackCents },
    idempotencyKey ? { idempotencyKey } : undefined
  );
  logFinancialEvent({
    event: 'PENALTY_DISTRIBUTED',
    stripePaymentIntentId: paymentIntentId,
    stripeReversalId: reversal.id,
    amountCents: clawbackCents,
    meta: { penalty_cents: penaltyCents, station_penalty_share: stationPenaltyShare },
  });
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
  /** Platform commission in cents. Applied as application_fee_amount so the platform
   *  earns revenue on tips and is not left absorbing Stripe processing fees alone. */
  commissionCents?: number;
  metadata?: Record<string, string>;
  /**
   * Stripe idempotency key — prevents duplicate PIs when the client retries (or two
   * concurrent tip requests race past the application-level unicity check). Pass
   * `tip-create:<reservationId>` so retries return the same PI instead of a new one.
   */
  idempotencyKey?: string;
};

/**
 * Creates a Stripe PaymentIntent for a client tip.
 * Uses a destination charge (transfer_data.destination) with application_fee_amount
 * so the platform earns its commission on tips and is not left absorbing Stripe
 * processing fees without revenue.
 * capture_method is 'automatic' - funds are captured immediately on confirmation.
 */
export async function createTipPaymentIntent(
  params: CreateTipPaymentIntentParams
): Promise<CreatePaymentIntentResult> {
  const {
    amountCents,
    currency,
    stationStripeAccountId,
    commissionCents = 0,
    metadata = {},
    idempotencyKey,
  } = params;

  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new ValidationError('Invalid tip amount');
  }
  if (!Number.isInteger(commissionCents) || commissionCents < 0 || commissionCents > amountCents) {
    throw new ValidationError('Invalid tip commission amount');
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

  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount: amountCents,
      currency,
      capture_method: 'automatic',
      application_fee_amount: commissionCents,
      transfer_data: { destination },
      metadata: mergedMetadata,
      automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );

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
 * Generates a one-time Stripe Express Dashboard login link for a connected account.
 * The station uses this URL to view their balance, payout history, and manage their bank account.
 * The link is single-use and expires quickly — never cache it.
 */
export async function createStripeExpressDashboardLink(accountId: string): Promise<string> {
  if (!accountId.startsWith('acct_')) {
    throw new ValidationError('Invalid connected account id for dashboard link');
  }
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
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
