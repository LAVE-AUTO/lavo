/**
 * Reservation cancellation with penalty calculation and Stripe refund.
 * Handles POST /reservations/:id/cancel for confirmed/pending reservations (client-initiated),
 * and the 'confirmed' branch of PATCH /station/entries/:id (station-initiated).
 *
 * Policy — identical regardless of who cancels (client or station):
 *   - Free cancellation if cancelled >= freeWindowMinutes before service start.
 *   - Late cancellation: penalty = station_service_total * penaltyRate (pre-tax, pre-platform-fee
 *     price only — the client isn't penalized on tax or the platform fee); refund = amount_paid - penalty
 *     (amount_paid is the full tax-inclusive total actually captured by Stripe).
 *   - Station-fault override (slot pushed past closing time) still waives the penalty either way —
 *     a station cannot be penalized for its own overrun, and a client shouldn't pay for it either.
 *
 * A late cancellation is a late cancellation regardless of who clicks the button: if the station
 * cancels on the client's behalf (e.g. the client called in, or didn't show and the station closed
 * it out manually instead of waiting for the no-show cron), the same fee applies as if the client
 * had cancelled themselves at that moment. This keeps the policy from being bypassable simply by
 * routing the cancellation through the station dashboard instead of the client app.
 *
 * Flow:
 *   1. Load reservation + time_slot start_time, scoped to the caller (client owns it, or station
 *      owns the station it belongs to).
 *   2. Check cancellable status (confirmed only).
 *   3. Read platform cancellation policy.
 *   4. Calculate penalty and refund amount.
 *   5. Atomic transaction: update status + penalty_amount + cancellation_reason + decrement slot.
 *   6. Stripe (after transaction to avoid holding locks during API calls):
 *      - Free cancellation: cancelPaymentIntent - releases the authorization, no charge.
 *      - Late cancellation: capturePaymentIntent (materialise charge), then partial refund,
 *        then distributePenalty to claw back platform's share from the station's transfer.
 *   7. Notify the client either way — they need to know their reservation was cancelled and
 *      what happened financially, whether they cancelled it themselves or the station did.
 */
import { db } from '@/lib/db';
import { ConflictError, NotFoundError } from '@/lib/errors';
import { parseTimeForDate } from '@/helpers/date-helper';
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';
import { getConfigByStationId } from '@/server/station/config-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import {
  capturePaymentIntent,
  cancelPaymentIntent,
  refundPaymentIntent,
  distributePenalty,
  classifyStripeError,
} from '@/server/payments/payment-service';
import { logFinancialEvent } from '@/server/payments/financial-event-logger';
import {
  findReservationWithSlot,
  findReservationWithSlotByStation,
  findEntryByIdAndUser,
  findEntryByIdAndStation,
  markPiCancelFailed,
  markRefundPersistFailed,
  setStripeTransferIdIfMissing,
  updateEntry,
  type Entry,
  type EntryWithSlot,
} from '@/server/reservations/entry-repository';
import { decrementSlotBookedCount } from '@/server/station/slot-repository';

const CANCELLABLE_STATUSES = ['confirmed'] as const;

/** Who initiated the cancellation — affects only the re-read ownership check and notification wording. */
type CancelActor =
  | { type: 'client'; userId: string }
  | { type: 'station'; stationId: string };

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
  const closingDate = parseTimeForDate(dateStr, config.closing_time as string);

  return slotStartTime >= closingDate;
}

export type CancelReservationResult = {
  entry: Entry;
  refundedAmount: number;
  penaltyAmount: number;
  isLateCancellation: boolean;
};

/**
 * Cancels a confirmed reservation on behalf of the client who owns it.
 * Applies a penalty if cancelled within the free cancellation window.
 */
export async function cancelReservation(
  reservationId: string,
  userId: string,
  reason?: string
): Promise<CancelReservationResult> {
  const reservation = await findReservationWithSlot(reservationId, userId);
  if (!reservation) throw new NotFoundError('Reservation not found');
  assertCancellable(reservation);
  return performCancellation(reservation, reason, { type: 'client', userId });
}

/**
 * Cancels a confirmed reservation on behalf of the station that owns it.
 * Applies the exact same penalty policy as `cancelReservation` — a late cancellation
 * is a late cancellation regardless of who performed it (see file header comment).
 */
export async function cancelReservationByStation(
  reservationId: string,
  stationId: string,
  reason?: string
): Promise<CancelReservationResult> {
  const reservation = await findReservationWithSlotByStation(reservationId, stationId);
  if (!reservation) throw new NotFoundError('Reservation not found');
  assertCancellable(reservation);
  return performCancellation(reservation, reason, { type: 'station', stationId });
}

function assertCancellable(reservation: EntryWithSlot): void {
  if (reservation.entry_type !== 'reservation') {
    throw new ConflictError('Only reservations can be cancelled via this endpoint');
  }
  if (!(CANCELLABLE_STATUSES as readonly string[]).includes(reservation.status)) {
    throw new ConflictError(
      `Reservation cannot be cancelled from status '${reservation.status}'`
    );
  }
}

/** Shared core: penalty computation, DB update, Stripe settlement, client notification. */
async function performCancellation(
  reservation: EntryWithSlot,
  reason: string | undefined,
  actor: CancelActor,
): Promise<CancelReservationResult> {
  const reservationId = reservation.id;

  const [policy, stationFault] = await Promise.all([
    getCancellationPolicy(),
    isStationFaultCancellation(reservation.slotStartTime, reservation.station_id),
  ]);

  // Defensive: amount_paid / station_service_total come from the DB as strings. Clamp to a
  // non-negative finite number so a corrupt / migrated row (negative value, NaN text) cannot
  // produce negative cents passed to Stripe. Mirrors the clamp applied in no-show-service.
  const rawAmount = parseFloat(reservation.amount_paid);
  const amountPaid = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
  const rawServiceAmount = parseFloat(reservation.station_service_total);
  const penaltyBaseAmount = Number.isFinite(rawServiceAmount) && rawServiceAmount > 0 ? rawServiceAmount : 0;
  const now = new Date();
  const slotStart = reservation.slotStartTime;

  const minutesUntilService = slotStart
    ? (slotStart.getTime() - now.getTime()) / 60_000
    : policy.freeWindowMinutes; // no slot => treat as free cancellation

  // Station-fault: slot was pushed past closing time by an overrun cascade.
  // The penalty is waived unconditionally - the client bears no responsibility.
  const isLateCancellation = !stationFault && minutesUntilService < policy.freeWindowMinutes;

  const penaltyAmount = isLateCancellation
    ? Math.max(0, Math.round(penaltyBaseAmount * policy.penaltyRate * 100) / 100)
    : 0;
  const refundedAmount = Math.max(0, Math.round((amountPaid - penaltyAmount) * 100) / 100);

  const updated = await db.transaction(async (tx) => {
    // Re-read inside the transaction to prevent double-cancel race condition.
    // Scoped to the same owner (client or station) as the initial lookup.
    const current = actor.type === 'client'
      ? await findEntryByIdAndUser(reservationId, actor.userId, tx)
      : await findEntryByIdAndStation(reservationId, actor.stationId, tx);
    if (!current) throw new NotFoundError('Reservation not found');
    if (!(CANCELLABLE_STATUSES as readonly string[]).includes(current.status)) {
      throw new ConflictError(`Reservation cannot be cancelled from status '${current.status}'`);
    }

    // Default reason when the station cancels without an explicit one, so audit/support
    // records can tell this apart from a client-supplied reason, a no-show, or a reschedule.
    const cancellationReason = reason ?? (actor.type === 'station' ? 'cancelled_by_station' : null);

    const entry = await updateEntry(
      reservationId,
      {
        status: 'cancelled',
        cancellation_reason: cancellationReason,
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
      // Cancelling it releases the hold on the client's card - no charge at all.
      // On failure we emit a PI_CANCEL_FAILED financial event so a reconciliation cron
      // (or a manual ops sweep) can pick the entry up and retry — without this the hold
      // would silently sit on the client's card until Stripe auto-expires it (bug #12).
      try {
        await cancelPaymentIntent(reservation.stripe_payment_id);
      } catch (e) {
        const err = classifyStripeError(e);
        console.error('[CANCEL_PAYMENT_INTENT_FAILED]', {
          reservationId,
          stripe_payment_id: reservation.stripe_payment_id,
          error_class: err.class,
          error_code: err.code,
          error: err.message,
        });
        logFinancialEvent({
          event: 'PI_CANCEL_FAILED',
          stripePaymentIntentId: reservation.stripe_payment_id,
          reservationId,
          entryId: reservationId,
          userId: reservation.user_id,
          stationId: reservation.station_id,
          meta: {
            error_class: err.class,
            error_code: err.code ?? null,
            context: actor.type === 'station' ? 'free_cancellation_by_station' : 'free_cancellation',
          },
        });
        // Mark for reconciliation cron retry. Best-effort: a DB failure here only loses the
        // retry signal — the financial event log still records the failure.
        await markPiCancelFailed(reservationId).catch(() => undefined);
      }
    } else {
      // Late cancellation: capture the full amount first (materialises the charge),
      // then issue a partial refund for the refundable portion,
      // then claw back the platform's penalty share from the station's transfer.
      let captureResult: Awaited<ReturnType<typeof capturePaymentIntent>> | null = null;
      try {
        captureResult = await capturePaymentIntent(reservation.stripe_payment_id);
      } catch (e) {
        const err = classifyStripeError(e);
        console.error('[CAPTURE_FAILED_FOR_LATE_CANCELLATION]', {
          reservationId,
          stripe_payment_id: reservation.stripe_payment_id,
          error_class: err.class,
          error_code: err.code,
          error: err.message,
        });
      }

      // charged=false means the PI was already cancelled before our capture (e.g. expired PI).
      // In that case, no funds were moved so we skip refund and penalty entirely.
      const charged = captureResult?.charged ?? false;
      const chargeId = captureResult?.chargeId ?? null;
      const transferId = captureResult?.transferId ?? null;

      if (charged && chargeId) {
        try {
          await updateEntry(reservationId, { stripe_charge_id: chargeId });
        } catch (e) {
          console.error('[STRIPE_CHARGE_ID_UPDATE_FAILED]', {
            reservationId,
            chargeId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (charged && transferId) {
        // Persist stripe_transfer_id so a future dispute refund can correctly decide whether
        // to reverse_transfer (bill the station) versus refund from the platform balance.
        await setStripeTransferIdIfMissing(reservationId, transferId).catch((e) => {
          console.error('[CANCEL_TRANSFER_ID_PERSIST_FAILED]', {
            reservationId,
            transferId,
            error: e instanceof Error ? e.message : String(e),
          });
        });
      }

      if (charged && refundedAmount > 0) {
        let refundId: string | null = null;
        try {
          refundId = await refundPaymentIntent(
            reservation.stripe_payment_id,
            Math.round(refundedAmount * 100),
            `reservation-cancel-refund:${reservationId}`
          );
        } catch (e) {
          console.error('[REFUND_FAILED]', {
            reservationId,
            stripe_payment_id: reservation.stripe_payment_id,
            refunded_amount_cents: Math.round(refundedAmount * 100),
            error: e instanceof Error ? e.message : String(e),
          });
        }
        // Persist refund id separately so a Stripe success followed by a DB hiccup is detectable
        // by ops (bug #26): the REFUND_ISSUED event already logged the refundId in payment-service,
        // so we emit a REFUND_PERSIST_FAILED for reconciliation.
        if (refundId) {
          try {
            await updateEntry(reservationId, { stripe_refund_id: refundId });
          } catch (e) {
            console.error('[REFUND_ID_PERSIST_FAILED]', {
              reservationId,
              stripe_refund_id: refundId,
              error: e instanceof Error ? e.message : String(e),
            });
            logFinancialEvent({
              event: 'REFUND_PERSIST_FAILED',
              stripePaymentIntentId: reservation.stripe_payment_id,
              stripeRefundId: refundId,
              reservationId,
              entryId: reservationId,
              userId: reservation.user_id,
              stationId: reservation.station_id,
              amountCents: Math.round(refundedAmount * 100),
            });
            await markRefundPersistFailed(reservationId).catch(() => undefined);
          }
        }
      }

      if (charged && penaltyAmount > 0) {
        try {
          const stationTransferCents = Math.round(parseFloat(reservation.station_payout ?? '0') * 100);
          await distributePenalty(
            reservation.stripe_payment_id,
            Math.round(penaltyAmount * 100),
            stationTransferCents,
            policy.stationPenaltyShare,
            `reservation-cancel-penalty:${reservationId}`,
            chargeId ?? undefined,
            transferId ?? undefined,
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

  // Single notification to the client — always, regardless of who cancelled: a station-
  // initiated cancellation previously fired no notification at all, leaving the client to
  // discover it by reopening the app. A previous iteration duplicated the push with a
  // `notifyStation: true` payload flag, but `notifyEntry` always targets `userId` (the client)
  // and the flag was never consumed downstream - it only caused a duplicate push to the client
  // and leaked the internal flag to the device `data` bag.
  const cancelledByStation = actor.type === 'station';
  await notifyEntry({
    entryId: reservationId,
    userId: reservation.user_id,
    stationId: reservation.station_id,
    type: 'reservation_cancelled',
    payload: { penaltyAmount, refundedAmount, isLateCancellation, cancelledByStation },
  });
  await notifyClientFeed({
    userId: reservation.user_id,
    entryId: reservationId,
    stationId: reservation.station_id,
    kind: 'reservation_cancelled',
    body: cancelledByStation
      ? 'La station a annulé votre réservation. Un remboursement a été initié.'
      : 'Votre réservation a été annulée et un remboursement a été initié.',
  });

  return { entry: updated, refundedAmount, penaltyAmount, isLateCancellation };
}
