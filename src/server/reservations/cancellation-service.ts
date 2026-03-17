/**
 * Reservation cancellation with penalty calculation and Stripe refund.
 * Handles POST /reservations/:id/cancel for confirmed/pending reservations.
 *
 * Policy:
 *   - Free cancellation if cancelled >= freeWindowMinutes before service start.
 *   - Late cancellation: penalty = amount_paid * penaltyRate; refund = amount_paid - penalty.
 *
 * Flow:
 *   1. Load reservation + time_slot start_time.
 *   2. Check ownership and cancellable status.
 *   3. Read platform cancellation policy.
 *   4. Calculate penalty and refund amount.
 *   5. Atomic transaction: update status + penalty_amount + cancellation_reason + decrement slot.
 *   6. Issue Stripe refund (after transaction to avoid holding locks during API call).
 *   7. Save stripe_refund_id.
 *   8. Send notifications to client and station.
 */
import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { refundPaymentIntent } from '@/server/payments/payment-service';
import {
  findReservationWithSlot,
  findEntryByIdAndUser,
  updateEntry,
  type Entry,
} from '@/server/reservations/entry-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';

const CANCELLABLE_STATUSES = ['confirmed', 'pending'] as const;

export type CancelReservationResult = {
  entry: Entry;
  refundedAmount: number;
  penaltyAmount: number;
  isLateCancellation: boolean;
};

/**
 * Cancels a confirmed or pending reservation with Stripe refund.
 * Applies a penalty if cancelled within the free cancellation window.
 */
export async function cancelReservation(
  reservationId: string,
  userId: string,
  reason?: string
): Promise<CancelReservationResult> {
  const reservation = await findReservationWithSlot(reservationId, userId);
  if (!reservation) throw new NotFoundError('Reservation not found');

  if (reservation.entry_type !== 'reservation') {
    throw new ConflictError('Only reservations can be cancelled via this endpoint');
  }

  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(reservation.status)) {
    throw new ConflictError(
      `Reservation cannot be cancelled from status '${reservation.status}'`
    );
  }

  const policy = await getCancellationPolicy();

  const amountPaid = parseFloat(reservation.amount_paid);
  const now = new Date();
  const slotStart = reservation.slotStartTime;

  const minutesUntilService = slotStart
    ? (slotStart.getTime() - now.getTime()) / 60_000
    : policy.freeWindowMinutes; // no slot => treat as free cancellation

  const isLateCancellation = minutesUntilService < policy.freeWindowMinutes;

  const penaltyAmount = isLateCancellation
    ? Math.round(amountPaid * policy.penaltyRate * 100) / 100
    : 0;
  const refundedAmount = Math.round((amountPaid - penaltyAmount) * 100) / 100;

  const updated = await db.transaction(async (tx) => {
    // Re-read inside the transaction to prevent double-cancel race condition.
    const current = await findEntryByIdAndUser(reservationId, userId, tx);
    if (!current) throw new NotFoundError('Reservation not found');
    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(current.status)) {
      throw new ConflictError(`Reservation cannot be cancelled from status '${current.status}'`);
    }

    const entry = await updateEntry(
      reservationId,
      {
        status: 'cancelled',
        cancellation_reason: reason ?? null,
        penalty_amount: penaltyAmount > 0 ? penaltyAmount.toFixed(2) : null,
      },
      tx
    );

    if (reservation.time_slot_id) {
      await decrementSlotBookedCount(reservation.time_slot_id, tx);
    }

    return entry;
  });

  if (reservation.stripe_payment_id && refundedAmount > 0) {
    try {
      const refundId = await refundPaymentIntent(
        reservation.stripe_payment_id,
        Math.round(refundedAmount * 100)
      );
      await updateEntry(reservationId, { stripe_refund_id: refundId });
    } catch (e) {
      console.error('Stripe refund failed for reservation', reservationId, e);
    }
  }

  await Promise.all([
    notifyEntry({
      entryId: reservationId,
      userId,
      stationId: reservation.station_id,
      type: 'reservation_cancelled',
      payload: { penaltyAmount, refundedAmount, isLateCancellation },
    }),
    notifyEntry({
      entryId: reservationId,
      userId,
      stationId: reservation.station_id,
      type: 'reservation_cancelled',
      payload: { penaltyAmount, refundedAmount, isLateCancellation, notifyStation: true },
    }),
  ]);

  return { entry: updated, refundedAmount, penaltyAmount, isLateCancellation };
}
