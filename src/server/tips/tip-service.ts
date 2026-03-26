import { db } from '@/lib/db';
import { reservations, stations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';
import { createTipPaymentIntent } from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { getPlatformSetting } from '@/server/admin/platform-settings-service';
import * as repo from './tip-repository';
import type { CreateTipInput } from '@/validators/tip';

/** Fallback when platform_currency setting is not configured. */
const DEFAULT_PLATFORM_CURRENCY = 'cad';
/** Fallback max tip when tip_max_amount setting is not configured. */
const DEFAULT_TIP_MAX_AMOUNT = 500;

export type CreateTipResult = {
  tip: repo.Tip;
  clientSecret: string;
};

/**
 * Creates a tip for a completed reservation.
 *
 * Rules enforced:
 * 1. The reservation must exist and belong to the authenticated client.
 * 2. The reservation must be in 'completed' status.
 * 3. No tip may have already been submitted for this reservation.
 * 4. The station must have a valid Stripe Connect account (stripe_account_id starting with 'acct_').
 * 5. The amount must not exceed the platform-configured maximum (key: tip_max_amount, default: 500).
 *
 * Flow:
 * - Stripe PaymentIntent created first (destination charge, 0% platform fee).
 * - Tip record inserted with status 'pending' and the PI id.
 * - reservations.tip_amount updated as a denormalized cache.
 * - Station and client notified.
 * - Returns the tip record + Stripe client_secret for frontend payment confirmation.
 *
 * Idempotency:
 * - The unique DB constraint on reservation_id prevents concurrent duplicate tips.
 * - The unique constraint on stripe_payment_intent_id prevents PI re-use.
 *
 * @throws AppError 404 — reservation or station not found
 * @throws AppError 403 — reservation does not belong to client
 * @throws AppError 422 — reservation not completed, or station not configured for payments
 * @throws AppError 409 — tip already exists for this reservation
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

  // 2. Ownership check — only the client who made the reservation can tip.
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
    getPlatformSetting('tip_max_amount'),
    getPlatformSetting('platform_currency'),
  ]);
  const maxAmount = maxRaw ? parseFloat(maxRaw) : DEFAULT_TIP_MAX_AMOUNT;
  const currency = currencyRaw?.trim().toLowerCase() || DEFAULT_PLATFORM_CURRENCY;
  if (!Number.isFinite(maxAmount) || data.amount > maxAmount) {
    throw new AppError(
      `Tip amount must not exceed ${Number.isFinite(maxAmount) ? maxAmount : DEFAULT_TIP_MAX_AMOUNT}`,
      HTTP_STATUS.UNPROCESSABLE_ENTITY
    );
  }

  // 7. Convert amount to cents (Stripe requires integers).
  const amountCents = Math.round(data.amount * 100);

  // 8. Create the Stripe PaymentIntent first.
  //    If the DB insert fails after this point the PI will remain uncaptured and expire.
  //    The reverse (DB record without a PI) would be worse, so PI creation goes first.
  const { paymentIntentId, clientSecret } = await createTipPaymentIntent({
    amountCents,
    currency,
    userId,
    stationId: reservation.station_id,
    stationStripeAccountId: station.stripe_account_id,
    reservationId,
  });

  // 10. Persist the tip record.
  const tip = await repo.createTip({
    reservation_id: reservationId,
    client_id: userId,
    station_id: reservation.station_id,
    amount: String(data.amount),
    stripe_payment_intent_id: paymentIntentId,
    status: 'pending',
  });

  // 11. Denormalize tip_amount onto the reservation row.
  await repo.setReservationTipAmount(reservationId, String(data.amount));

  // 12. Notify station — fire-and-forget (notification failure must not abort the tip).
  if (station.user_id) {
    notifyEntry({
      userId: station.user_id,
      entryId: reservationId,
      type: 'tip_received',
      stationId: reservation.station_id,
    }).catch(() => undefined);
  }

  // 13. Notify client (confirmation) — fire-and-forget.
  notifyEntry({
    userId,
    entryId: reservationId,
    type: 'tip_sent',
  }).catch(() => undefined);

  return { tip, clientSecret };
}
