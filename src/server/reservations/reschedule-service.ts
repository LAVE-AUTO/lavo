/**
 * Reservation reschedule: change an existing confirmed reservation to a new time slot.
 *
 * Two cases depending on the cancellation policy window:
 *
 * Case 1 — Free reschedule (before penalty window):
 *   - Old entry cancelled (reason='rescheduled'), old slot decremented.
 *   - New entry created in 'confirmed' state, reusing the existing PaymentIntent.
 *   - Stripe PI metadata updated to point to the new reservation (non-fatal if it fails).
 *   - stripe_payment_succeeded_at copied to new entry so escrow notifications fire on completion.
 *   - No new charge; clientSecret is null.
 *
 * Case 2 — Late reschedule (within penalty window):
 *   - Old entry cancelled with penalty applied (capture + partial refund + penalty distribution).
 *   - New entry created in 'pending_payment' state with a brand-new PaymentIntent.
 *   - Client must complete payment using the returned clientSecret.
 *
 * In both cases the DB transaction is committed first; Stripe calls follow outside the transaction
 * to avoid holding locks during network I/O (consistent with the pattern in reservation-service.ts
 * and cancellation-service.ts).
 *
 * A reschedule_request record is always created on success for audit purposes.
 */
import { db } from '@/lib/db';
import { rescheduleRequests } from '@/lib/db/schema';
import { ConflictError, NotFoundError, SlotFullError } from '@/lib/errors';
import { MAX_ADVANCE_BOOKING_DAYS } from '@/helpers/constants';
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';
import {
  capturePaymentIntent,
  createPaymentIntent,
  distributePenalty,
  refundPaymentIntent,
  updatePaymentIntentMetadata,
} from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { findStationById } from '@/server/station/station-repository';
import {
  countReservationsBySlotId,
  incrementSlotBookedCount,
  decrementSlotBookedCount,
  lockSlotForUpdate,
} from '@/server/station/slot-repository';
import {
  createReservationEntry,
  findEntryByIdAndUser,
  findReservationWithSlot,
  setStripePaymentSucceededAtIfMissing,
  updateEntry,
  type Entry,
} from './entry-repository';

export type RescheduleResult = {
  originalEntry: Entry;
  newEntry: Entry;
  isLateCancellation: boolean;
  penaltyAmount: number;
  refundedAmount: number;
  /** Present only in Case 2: client must complete payment on this secret. */
  clientSecret: string | null;
};

const RESCHEDULABLE_STATUSES = ['confirmed'] as const;

/**
 * Reschedules a confirmed reservation to a new time slot.
 *
 * @param reservationId - Existing reservation to reschedule
 * @param userId        - Authenticated client id (ownership check)
 * @param newTimeSlotId - Target time slot
 * @param stationStripeAccountId - Station's Stripe Connect account (needed for Case 2 new PI)
 */
export async function rescheduleReservation(
  reservationId: string,
  userId: string,
  newTimeSlotId: string,
  stationStripeAccountId: string
): Promise<RescheduleResult> {
  const reservation = await findReservationWithSlot(reservationId, userId);
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (reservation.entry_type !== 'reservation') {
    throw new ConflictError('Only reservations can be rescheduled');
  }
  if (!(RESCHEDULABLE_STATUSES as readonly string[]).includes(reservation.status)) {
    throw new ConflictError(`Reservation cannot be rescheduled from status '${reservation.status}'`);
  }
  if (reservation.time_slot_id === newTimeSlotId) {
    throw new ConflictError('New time slot is the same as the current one');
  }

  const policy = await getCancellationPolicy();
  const amountPaid = parseFloat(reservation.amount_paid);
  const slotStart = reservation.slotStartTime;
  const minutesUntilService = slotStart
    ? (slotStart.getTime() - Date.now()) / 60_000
    : policy.freeWindowMinutes;

  const isLateCancellation = minutesUntilService < policy.freeWindowMinutes;
  const penaltyAmount = isLateCancellation
    ? Math.round(amountPaid * policy.penaltyRate * 100) / 100
    : 0;
  const refundedAmount = Math.round((amountPaid - penaltyAmount) * 100) / 100;

  // ─── Atomic DB transaction ────────────────────────────────────────────────
  const { oldEntry, newEntry } = await db.transaction(async (tx) => {
    // Re-read inside transaction to prevent double-reschedule race condition.
    const current = await findEntryByIdAndUser(reservationId, userId, tx);
    if (!current) throw new NotFoundError('Reservation not found');
    if (!(RESCHEDULABLE_STATUSES as readonly string[]).includes(current.status)) {
      throw new ConflictError(`Reservation cannot be rescheduled from status '${current.status}'`);
    }

    // Lock the new slot and verify capacity.
    const newSlot = await lockSlotForUpdate(newTimeSlotId, reservation.station_id, tx);
    if (!newSlot) throw new NotFoundError('New time slot not found or does not belong to this station');

    const maxAdvanceMs = MAX_ADVANCE_BOOKING_DAYS * 24 * 60 * 60 * 1000;
    if (newSlot.start_time.getTime() - Date.now() > maxAdvanceMs) {
      throw new ConflictError(`Reservations cannot be made more than ${MAX_ADVANCE_BOOKING_DAYS} days in advance`);
    }

    const slotCount = await countReservationsBySlotId(newTimeSlotId, tx);
    if (slotCount >= (newSlot.capacity ?? 0)) throw new SlotFullError();

    // Case 1: carry the existing PI forward; new entry is immediately confirmed.
    // Case 2: new entry starts in pending_payment; a new PI is created after the transaction.
    const newStatus = isLateCancellation ? 'pending_payment' : 'confirmed';
    const newStripePaymentId = isLateCancellation ? null : reservation.stripe_payment_id;

    const created = await createReservationEntry(
      {
        user_id: userId,
        station_id: reservation.station_id,
        vehicle_format_id: reservation.vehicle_format_id,
        time_slot_id: newTimeSlotId,
        status: newStatus,
        amount_paid: reservation.amount_paid,
        commission_rate: reservation.commission_rate,
        commission_amount: reservation.commission_amount ?? undefined,
        station_payout: reservation.station_payout ?? undefined,
        stripe_payment_id: newStripePaymentId,
      },
      tx
    );

    // Mark as confirmed immediately for Case 1.
    const newEntryRow = isLateCancellation
      ? created
      : await updateEntry(created.id, { confirmed_at: new Date() }, tx);

    // Cancel the old reservation.
    // In Case 1 (no penalty) the new entry inherits the existing stripe_payment_id; clear it on
    // the old row so findEntryByStripePaymentId (used by Stripe webhooks) unambiguously resolves
    // to the new entry and never operates on the cancelled one.
    const oldEntryRow = await updateEntry(
      reservationId,
      {
        status: 'cancelled',
        cancellation_reason: 'rescheduled',
        penalty_amount: penaltyAmount > 0 ? penaltyAmount.toFixed(2) : null,
        ...(!isLateCancellation && { stripe_payment_id: null }),
      },
      tx
    );

    // Update slot counts.
    if (reservation.time_slot_id) {
      await decrementSlotBookedCount(reservation.time_slot_id, tx);
    }
    await incrementSlotBookedCount(newTimeSlotId, tx);

    return { oldEntry: oldEntryRow, newEntry: newEntryRow };
  });

  // ─── Stripe operations (outside transaction) ──────────────────────────────
  let clientSecret: string | null = null;

  if (isLateCancellation) {
    // Case 2: settle old PI, then open a new one.
    // If the original PI had no payment (no stripe_payment_id), skip capture/refund entirely
    // and proceed directly to creating the new PI.
    if (reservation.stripe_payment_id) {
      let captured = false;
      let chargeId: string | null = null;
      let transferId: string | null = null;
      try {
        ({ chargeId, transferId } = await capturePaymentIntent(reservation.stripe_payment_id));
        captured = true;
      } catch (e) {
        console.error('[RESCHEDULE_CAPTURE_FAILED]', {
          reservationId,
          stripe_payment_id: reservation.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }

      if (!captured) {
        // The original payment authorization could not be settled. Creating a new PI now would
        // leave two active authorizations on the client's card. Abort and surface the error.
        throw new Error(
          `[RESCHEDULE_CAPTURE_FAILED] Could not capture original PaymentIntent ${reservation.stripe_payment_id} — reschedule aborted to prevent double charge. Manual resolution required for reservation ${reservationId}.`
        );
      }

      if (captured && chargeId) {
        try {
          await updateEntry(reservationId, { stripe_charge_id: chargeId });
        } catch (e) {
          console.error('[RESCHEDULE_STRIPE_CHARGE_ID_UPDATE_FAILED]', {
            reservationId,
            chargeId,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      if (captured && refundedAmount > 0) {
        try {
          const refundId = await refundPaymentIntent(
            reservation.stripe_payment_id,
            Math.round(refundedAmount * 100)
          );
          await updateEntry(reservationId, { stripe_refund_id: refundId });
        } catch (e) {
          console.error('[RESCHEDULE_REFUND_FAILED]', {
            reservationId,
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
            policy.stationPenaltyShare,
            undefined,
            chargeId ?? undefined,
            transferId ?? undefined,
          );
        } catch (e) {
          console.error('[RESCHEDULE_PENALTY_DISTRIBUTION_FAILED]', {
            reservationId,
            penalty_amount_cents: Math.round(penaltyAmount * 100),
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Create a new PaymentIntent for the rescheduled reservation.
    const amountCents = Math.round(amountPaid * 100);
    const commissionRate = parseFloat(reservation.commission_rate);
    const commissionCents = Math.round(amountPaid * commissionRate * 100);

    try {
      const { paymentIntentId, clientSecret: cs } = await createPaymentIntent({
        amountCents,
        userId,
        stationId: reservation.station_id,
        stationStripeAccountId,
        commissionCents,
        metadata: {
          reservation_id: newEntry.id,
          time_slot_id: newTimeSlotId,
          vehicle_format_id: reservation.vehicle_format_id,
          rescheduled_from: reservationId,
        },
      });
      await updateEntry(newEntry.id, { stripe_payment_id: paymentIntentId });
      clientSecret = cs;
    } catch (e) {
      // New PI failed: new reservation is stuck in pending_payment with no stripe_payment_id.
      // Log for manual resolution — do not silently swallow.
      console.error('[RESCHEDULE_NEW_PI_FAILED] New PaymentIntent creation failed — manual resolution required', {
        newReservationId: newEntry.id,
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  } else {
    // Case 1: carry existing PI forward.
    // Copy stripe_payment_succeeded_at so the escrow notification fires on completion.
    if (reservation.stripe_payment_succeeded_at) {
      try {
        await setStripePaymentSucceededAtIfMissing(
          newEntry.id,
          reservation.stripe_payment_succeeded_at
        );
      } catch (e) {
        console.error('[RESCHEDULE_COPY_SUCCEEDED_AT_FAILED]', {
          newReservationId: newEntry.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Update PI metadata to point to the new reservation (informational, non-fatal).
    if (reservation.stripe_payment_id) {
      try {
        await updatePaymentIntentMetadata(reservation.stripe_payment_id, {
          reservation_id: newEntry.id,
          time_slot_id: newTimeSlotId,
          rescheduled_from: reservationId,
        });
      } catch (e) {
        console.error('[RESCHEDULE_PI_METADATA_UPDATE_FAILED]', {
          stripe_payment_id: reservation.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  // ─── Audit record ─────────────────────────────────────────────────────────
  try {
    await db.insert(rescheduleRequests).values({
      original_reservation_id: reservationId,
      new_reservation_id: newEntry.id,
      user_id: userId,
      station_id: reservation.station_id,
      had_penalty: isLateCancellation,
      penalty_amount: penaltyAmount > 0 ? penaltyAmount.toFixed(2) : null,
      refunded_amount: refundedAmount.toFixed(2),
    });
  } catch (e) {
    // Non-fatal: audit record failure must not roll back the reschedule.
    console.error('[RESCHEDULE_AUDIT_INSERT_FAILED]', {
      originalReservationId: reservationId,
      newReservationId: newEntry.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // ─── Notifications ────────────────────────────────────────────────────────
  try {
    await notifyEntry({
      entryId: newEntry.id,
      userId,
      stationId: reservation.station_id,
      type: 'reservation_rescheduled',
      payload: { isLateCancellation, penaltyAmount, refundedAmount },
    });
  } catch (e) {
    console.error('[RESCHEDULE_CLIENT_NOTIFY_FAILED]', {
      newReservationId: newEntry.id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const station = await findStationById(reservation.station_id);
  const stationManagerId = station?.user_id ?? null;
  if (stationManagerId) {
    try {
      await notifyEntry({
        entryId: newEntry.id,
        userId: stationManagerId,
        stationId: reservation.station_id,
        type: 'reschedule_station_notified',
        payload: { originalReservationId: reservationId },
      });
    } catch (e) {
      console.error('[RESCHEDULE_STATION_NOTIFY_FAILED]', {
        newReservationId: newEntry.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return {
    originalEntry: oldEntry,
    newEntry,
    isLateCancellation,
    penaltyAmount,
    refundedAmount,
    clientSecret,
  };
}
