/**
 * Tip service: create tips for completed reservations.
 *
 * Features:
 *   - createTip: submit tip with Stripe payment flow
 *
 * Validation:
 *   - Reservation must exist and belong to client
 *   - Reservation must be completed
 *   - One tip per reservation (unique constraint)
 *   - Station must have Stripe Connect account
 *   - Amount must not exceed platform maximum
 *
 * Flow:
 *   1. Fetch and validate reservation
 *   2. Check ownership and status
 *   3. Check no existing tip (prevent duplicates)
 *   4. Fetch station and verify Stripe account
 *   5. Read platform settings (max amount, currency) with fallback
 *   6. Create Stripe PaymentIntent (destination charge, 0% platform fee)
 *   7. Insert tip record with status=pending
 *   8. Denormalize tip_amount onto reservation row
 *   9. Send notifications (fire-and-forget)
 *   10. Return tip + client_secret for payment confirmation UI
 *
 * Idempotency:
 *   - Unique constraint on reservation_id prevents concurrent duplicates
 *   - Unique constraint on stripe_payment_intent_id prevents PI re-use
 */
import { db } from '@/lib/db';
import { reservations, reservationTips, stations } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { AppError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';
import { DEFAULT_PLATFORM_CURRENCY } from '@/helpers/server-constants';
import { createTipPaymentIntent } from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';
import * as repo from './tip-repository';
import type { CreateTipInput } from '@/validators/tip';


// %%%%% Constants %%%%%
// Fallback default for platform settings (currency is shared with payment-service via
// server-constants to keep tip and reservation flows aligned — bug #25).

const DEFAULT_TIP_MAX_AMOUNT = 50000;


// %%%%% Types %%%%%
// Operation results

export type CreateTipResult = {
  tip: repo.Tip;
  clientSecret: string;
};


// %%%%% Tip creation %%%%%
// Create tip with full validation and Stripe integration

/**
 * Creates a tip for a completed reservation with full validation.
 *
 * Validation rules enforced:
 *   1. Reservation must exist
 *   2. Reservation must belong to the authenticated client (ownership check)
 *   3. Reservation must have status='completed'
 *   4. No tip may already exist for this reservation (unique constraint)
 *   5. Station must have valid Stripe Connect account (acct_* format)
 *   6. Tip amount must not exceed platform-configured maximum
 *
 * Error responses:
 *   - 404: reservation or station not found
 *   - 403: reservation does not belong to client
 *   - 422: reservation not completed, or station not configured for payments
 *   - 409: tip already exists for this reservation
 *
 * @param userId - Client UUID (from auth)
 * @param reservationId - Reservation UUID to tip for
 * @param data - Validated { amount } from request body
 * @returns CreateTipResult with tip record and Stripe client_secret
 * @throws AppError 404 | 403 | 422 | 409 as documented above
 */
export async function createTip(
  userId: string,
  reservationId: string,
  data: CreateTipInput
): Promise<CreateTipResult> {
  // 1. Fetch the reservation.
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, reservationId),
    columns: { id: true, user_id: true, station_id: true, status: true },
  });
  if (!reservation) {
    throw new AppError('Reservation not found', HTTP_STATUS.NOT_FOUND);
  }

  // 2. Ownership check - only the client who made the reservation can tip.
  if (reservation.user_id !== userId) {
    throw new AppError('Forbidden', HTTP_STATUS.FORBIDDEN);
  }

  // 3. The reservation must be completed before a tip can be given.
  if (reservation.status !== 'completed') {
    throw new AppError(
      'Tip can only be sent for a completed reservation',
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }

  // 4. One tip per reservation.
  const existing = await repo.findTipByReservationId(reservationId);
  if (existing) {
    throw new AppError(
      'A tip has already been sent for this reservation',
      HTTP_STATUS.CONFLICT
    );
  }

  // 5. The station must have a valid Stripe Connect account to receive funds.
  const station = await db.query.stations.findFirst({
    where: eq(stations.id, reservation.station_id),
    columns: { id: true, user_id: true, stripe_account_id: true },
  });
  if (!station) {
    throw new AppError('Station not found', HTTP_STATUS.NOT_FOUND);
  }
  if (!station.stripe_account_id?.startsWith('acct_')) {
    throw new AppError(
      'This station is not configured to receive payments',
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }

  // 6. Read platform settings (max tip + currency) in parallel.
  const [maxRaw, currencyRaw] = await Promise.all([
    getPlatformSettingWithFallback('max_tip_amount_xaf', 'PLATFORM_MAX_TIP_AMOUNT_XAF', String(DEFAULT_TIP_MAX_AMOUNT)),
    getPlatformSettingWithFallback('platform_currency', 'PLATFORM_CURRENCY', DEFAULT_PLATFORM_CURRENCY),
  ]);
  // Strip whitespace before parsing (e.g. "50 000" → 50000) to guard against
  // locale-formatted values stored by an admin ("50 000 XAF", "50,000").
  const maxAmount = parseInt(maxRaw.replace(/[\s,]/g, ''), 10);
  const currency = currencyRaw.trim().toLowerCase() || DEFAULT_PLATFORM_CURRENCY;
  const effectiveMax = Number.isFinite(maxAmount) && maxAmount > 0 ? maxAmount : DEFAULT_TIP_MAX_AMOUNT;
  if (data.amount > effectiveMax) {
    throw new AppError(
      `Tip amount must not exceed ${effectiveMax}`,
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }

  // 7. Convert amount to cents (Stripe requires integers).
  const amountCents = Math.round(data.amount * 100);

  // 8. Reserve unicity at the DB level BEFORE creating the Stripe PI.
  // Two concurrent tip requests for the same reservation must not both reach the
  // Stripe API: capture_method='automatic' means each PI charges the client immediately.
  // We insert a placeholder row (stripe_payment_intent_id='pending:<uuid>') under the
  // unique constraint; the loser gets 23505 → 409. The winner then creates the PI
  // and updates the row with the real intent id.
  const placeholderPiId = `pending:${reservationId}`;
  let reservedTip: typeof reservationTips.$inferSelect;
  try {
    [reservedTip] = await db
      .insert(reservationTips)
      .values({
        reservation_id: reservationId,
        client_id: userId,
        station_id: reservation.station_id,
        amount: data.amount.toFixed(2),
        stripe_payment_intent_id: placeholderPiId,
        status: 'pending',
      })
      .returning();
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err
      ? (err as { code?: string }).code
      : undefined;
    if (code === '23505') {
      throw new AppError('A tip has already been sent for this reservation', HTTP_STATUS.CONFLICT);
    }
    throw err;
  }

  // 9. Create the Stripe PaymentIntent with a stable idempotency key so a network
  //    retry on this exact reservation returns the same PI rather than minting a new one.
  let paymentIntentId: string;
  let clientSecret: string;
  try {
    const pi = await createTipPaymentIntent({
      amountCents,
      currency,
      userId,
      stationId: reservation.station_id,
      stationStripeAccountId: station.stripe_account_id,
      reservationId,
      idempotencyKey: `tip-create:${reservationId}`,
    });
    paymentIntentId = pi.paymentIntentId;
    clientSecret = pi.clientSecret;
  } catch (err) {
    // Roll back the placeholder so the client can retry the whole flow (e.g. card details fix).
    // Best-effort: a failed delete just leaves a 'pending' row the orphan-tip cron can sweep later.
    await db.delete(reservationTips).where(eq(reservationTips.id, reservedTip.id)).catch(() => undefined);
    throw err;
  }

  // 10. Replace placeholder with real PI id + denormalize tip_amount on the reservation.
  const tip = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(reservationTips)
      .set({ stripe_payment_intent_id: paymentIntentId, updated_at: new Date() })
      .where(eq(reservationTips.id, reservedTip.id))
      .returning();
    await tx
      .update(reservations)
      .set({ tip_amount: data.amount.toFixed(2), updated_at: sql`now()` })
      .where(eq(reservations.id, reservationId));
    return updated ?? reservedTip;
  });

  // 11. Notify station - fire-and-forget (notification failure must not abort the tip).
  if (station.user_id) {
    notifyEntry({
      userId: station.user_id,
      entryId: reservationId,
      type: 'tip_received',
      stationId: reservation.station_id,
    }).catch(() => undefined);
  }

  // 12. Notify client (confirmation) - fire-and-forget.
  notifyEntry({
    userId,
    entryId: reservationId,
    type: 'tip_sent',
  }).catch(() => undefined);
  notifyClientFeed({
    userId,
    entryId: reservationId,
    stationId: reservation.station_id,
    kind: 'tip_sent',
    body: 'Votre pourboire a bien été envoyé. Merci !',
  }).catch(() => undefined);

  return { tip, clientSecret };
}
