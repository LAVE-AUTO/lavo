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
 *   2. Check ownership and cancellable status (confirmed only).
 *   3. Read platform cancellation policy.
 *   4. Calculate penalty and refund amount.
 *   5. Atomic transaction: update status + penalty_amount + cancellation_reason + decrement slot.
 *   6. Stripe (after transaction to avoid holding locks during API calls):
 *      - Free cancellation: cancelPaymentIntent — releases the authorization, no charge.
 *      - Late cancellation: capturePaymentIntent (materialise charge), then partial refund,
 *        then distributePenalty to claw back platform's share from the station's transfer.
 *   7. Send notifications to client and station.
 */
import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';
import { getConfigByStationId } from '@/server/station/config-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import {
  capturePaymentIntent,
  cancelPaymentIntent,
  refundPaymentIntent,
  distributePenalty,
} from '@/server/payments/payment-service';
import {
  findReservationWithSlot,
  findEntryByIdAndUser,
  updateEntry,
  type Entry,
} from '@/server/reservations/entry-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';

const CANCELLABLE_STATUSES = ['confirmed'] as const;

/**
 * Returns true if the reservation's current slot starts at or after the station's closing time.
 * This indicates a station-fault situation: an overrun cascade pushed the slot outside hours.
 * In this case the penalty is waived and the client receives a full refund.
 */
async function isStationFaultCancellation(
  slotStartTime: Date | null,
  stationId: string
): Promise<boolean> {
  if (!slotStartTime) return false;
  const config = await getConfigByStationId(stationId);
  if (!config?.closing_time) return false;

  const dateStr = slotStartTime.toISOString().slice(0, 10);
  let t = (config.closing_time as string).trim();
  if (t.length === 5) t += ':00';
  if (!t.endsWith('Z') && !t.includes('+')) t += 'Z';
  if (t.endsWith('+00')) t = t.slice(0, -3) + 'Z';
  const closingDate = new Date(`${dateStr}T${t}`);

  return slotStartTime >= closingDate;
}

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

  const [policy, stationFault] = await Promise.all([
    getCancellationPolicy(),
    isStationFaultCancellation(reservation.slotStartTime, reservation.station_id),
  ]);

  const amountPaid = parseFloat(reservation.amount_paid);
  const now = new Date();
  const slotStart = reservation.slotStartTime;

  const minutesUntilService = slotStart
    ? (slotStart.getTime() - now.getTime()) / 60_000
    : policy.freeWindowMinutes; // no slot => treat as free cancellation

  // Station-fault: slot was pushed past closing time by an overrun cascade.
  // The penalty is waived unconditionally — the client bears no responsibility.
  const isLateCancellation = !stationFault && minutesUntilService < policy.freeWindowMinutes;

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

  if (reservation.stripe_payment_id) {
    if (!isLateCancellation) {
      // Free cancellation: the PaymentIntent was authorized but never captured.
      // Cancelling it releases the hold on the client's card — no charge at all.
      try {
        await cancelPaymentIntent(reservation.stripe_payment_id);
      } catch (e) {
        console.error('[CANCEL_PAYMENT_INTENT_FAILED]', {
          reservationId,
          stripe_payment_id: reservation.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    } else {
      // Late cancellation: capture the full amount first (materialises the charge),
      // then issue a partial refund for the refundable portion,
      // then claw back the platform's penalty share from the station's transfer.
      let captured = false;
      try {
        await capturePaymentIntent(reservation.stripe_payment_id);
        captured = true;
      } catch (e) {
        console.error('[CAPTURE_FAILED_FOR_LATE_CANCELLATION]', {
          reservationId,
          stripe_payment_id: reservation.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      if (captured && refundedAmount > 0) {
        try {
          const refundId = await refundPaymentIntent(
            reservation.stripe_payment_id,
            Math.round(refundedAmount * 100)
          );
          await updateEntry(reservationId, { stripe_refund_id: refundId });
        } catch (e) {
          console.error('[REFUND_FAILED]', {
            reservationId,
            stripe_payment_id: reservation.stripe_payment_id,
            refunded_amount_cents: Math.round(refundedAmount * 100),
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (captured && penaltyAmount > 0) {
        try {
          await distributePenalty(
            reservation.stripe_payment_id,
            Math.round(penaltyAmount * 100),
            policy.stationPenaltyShare
          );
        } catch (e) {
          console.error('[PENALTY_DISTRIBUTION_FAILED]', {
            reservationId,
            stripe_payment_id: reservation.stripe_payment_id,
            penalty_amount_cents: Math.round(penaltyAmount * 100),
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
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
