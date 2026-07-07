/**
 * Reservation reschedule: change an existing confirmed reservation to a new time slot.
 *
 * Two cases depending on the cancellation policy window:
 *
 * Case 1 - Free reschedule (before penalty window):
 *   - Old entry cancelled (reason='rescheduled'), old slot decremented.
 *   - New entry created in 'confirmed' state, reusing the existing PaymentIntent.
 *   - Stripe PI metadata updated to point to the new reservation (non-fatal if it fails).
 *   - stripe_payment_succeeded_at copied to new entry so escrow notifications fire on completion.
 *   - No new charge; clientSecret is null.
 *
 * Case 2 - Late reschedule (within penalty window):
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
import { rescheduleRequests, timeSlots as timeSlotsTable } from '@/lib/db/schema';
import { ConflictError, NotFoundError, SlotFullError } from '@/lib/errors';
import { MAX_ADVANCE_BOOKING_DAYS } from '@/helpers/constants';
import { getCancellationPolicy } from '@/server/admin/platform-settings-service';
import {
  capturePaymentIntent,
  classifyStripeError,
  createPaymentIntent,
  distributePenalty,
  refundPaymentIntent,
  updatePaymentIntentMetadata,
} from '@/server/payments/payment-service';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { findStationById } from '@/server/station/station-repository';
import { findMatchingAvailabilitySlot } from '@/server/station/post-availability-service';
import { findSlotById } from '@/server/station/slot-repository';
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
  setStripeTransferIdIfMissing,
  updateEntry,
  type Entry,
} from './entry-repository';
import { sql as sqlInline } from 'drizzle-orm';

export type RescheduleResult = {
  originalEntry: Entry;
  newEntry: Entry;
  isLateCancellation: boolean;
  penaltyAmount: number;
  refundedAmount: number;
  /** Present only in Case 2: client must complete payment on this secret. */
  clientSecret: string | null;
};

/**
 * Statuses a client may reschedule. Beyond a fully confirmed reservation, a
 * not-yet-paid one (pending / pending_payment) can also move slots: a free
 * reschedule simply carries the existing PaymentIntent to the new slot and keeps
 * the pending state, so the eventual payment confirmation still applies.
 */
const RESCHEDULABLE_STATUSES = ['confirmed', 'pending', 'pending_payment'] as const;


// %%%%% Reschedule by start time %%%%%
// Modern flow: caller provides an ISO start_time (from /stations/:id/availability).
// The server picks an active wash post, atomically inserts a new time_slots row,
// then delegates to rescheduleReservation with the freshly created slot id.

/**
 * Reschedules a confirmed reservation to a target ISO start_time.
 * The duration is inferred from the original reservation's slot length.
 */
export async function rescheduleReservationByStartTime(
  reservationId: string,
  userId: string,
  newStartTimeIso: string,
  stationStripeAccountId: string,
): Promise<RescheduleResult> {
  const reservation = await findReservationWithSlot(reservationId, userId);
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (reservation.entry_type !== 'reservation') {
    throw new ConflictError('Only reservations can be rescheduled');
  }
  if (!(RESCHEDULABLE_STATUSES as readonly string[]).includes(reservation.status)) {
    throw new ConflictError(`Reservation cannot be rescheduled from status '${reservation.status}'`);
  }

  /* Duration is inherited from the original slot — same service, same format,
   * same expected time. Default to 30 min when the original slot is missing. */
  let durationMin = 30;
  if (reservation.time_slot_id) {
    const originalSlot = await findSlotById(reservation.time_slot_id);
    if (originalSlot?.start_time && originalSlot?.end_time) {
      durationMin = Math.max(
        1,
        Math.round((originalSlot.end_time.getTime() - originalSlot.start_time.getTime()) / 60_000),
      );
    }
  }

  const newStart = new Date(newStartTimeIso);
  if (Number.isNaN(newStart.getTime())) {
    throw new ConflictError('Invalid new_start_time');
  }
  if (reservation.slotStartTime && newStart.getTime() === reservation.slotStartTime.getTime()) {
    throw new ConflictError('New time slot is the same as the current one');
  }

  /* Pre-check (cheap, non-locking): make sure at least one post is free at
   * `newStart`. The transactional insert below is the source of truth. */
  const preMatch = await findMatchingAvailabilitySlot(
    reservation.station_id,
    newStartTimeIso,
    durationMin,
  );
  if (!preMatch) throw new SlotFullError();

  const endTime = new Date(newStart.getTime() + durationMin * 60_000);

  /* Insert the one-shot time slot inside a short transaction that locks the
   * station's posts (mirrors createReservationByStartTime). booked_count
   * starts at 0 so the existing rescheduleReservation flow can lock it,
   * verify capacity, and increment. */
  const newSlotId = await db.transaction(async (tx) => {
    await tx.execute(
      sqlInline`SELECT id FROM station_posts WHERE station_id = ${reservation.station_id} AND is_active = true FOR UPDATE`,
    );

    const fresh = await findMatchingAvailabilitySlot(
      reservation.station_id,
      newStartTimeIso,
      durationMin,
    );
    if (!fresh) throw new SlotFullError();

    const [slot] = await tx
      .insert(timeSlotsTable)
      .values({
        station_id: reservation.station_id,
        start_time: newStart,
        end_time: endTime,
        capacity: 1,
        booked_count: 0,
        status: 'available',
      })
      .returning();
    if (!slot) throw new Error('Insert time slot for reschedule failed');
    return slot.id;
  });

  return rescheduleReservation(reservationId, userId, newSlotId, stationStripeAccountId);
}

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

    // Case 1 (free reschedule): carry the existing PI forward. An already
    // confirmed reservation re-confirms immediately; a not-yet-paid one keeps its
    // pending state so the later payment confirmation still drives it to confirmed.
    // Case 2 (late): new entry starts in pending_payment; a new PI is created after the transaction.
    const newStatus = isLateCancellation
      ? 'pending_payment'
      : current.status === 'confirmed'
        ? 'confirmed'
        : current.status;
    const newStripePaymentId = isLateCancellation ? null : reservation.stripe_payment_id;

    const created = await createReservationEntry(
      {
        user_id: userId,
        station_id: reservation.station_id,
        vehicle_format_id: reservation.vehicle_format_id,
        // Preserve the service, post, booking source and ticket code from the original
        // reservation. Without these, the station cannot validate the ticket code at start
        // (InvalidTicketCodeError), the receipt PDF loses its service label, and the per-post
        // availability layer cannot reuse the same wash bay.
        service_id: reservation.service_id ?? null,
        post_id: reservation.post_id ?? null,
        booking_source: (reservation.booking_source as 'standard' | 'qr') ?? 'standard',
        ticket_code: reservation.ticket_code ?? null,
        time_slot_id: newTimeSlotId,
        status: newStatus,
        amount_paid: reservation.amount_paid,
        // Commission policy on FREE reschedule: keep the original commission_rate / amounts.
        // Reason: in Case 1 the PaymentIntent is reused, and Stripe's application_fee_amount
        // is fixed at PI creation — recomputing the rate here would create a mismatch between
        // what Stripe withholds and what we record. The client made their commitment under the
        // commission rate in force at booking time; reschedule is not a re-pricing event.
        // For LATE reschedule (Case 2 below), a fresh PI is created with the current rate.
        commission_rate: reservation.commission_rate,
        commission_amount: reservation.commission_amount ?? undefined,
        station_payout: reservation.station_payout ?? undefined,
        station_service_total: reservation.station_service_total ?? undefined,
        platform_service_fee: reservation.platform_service_fee ?? undefined,
        taxable_subtotal: reservation.taxable_subtotal ?? undefined,
        tps_amount: reservation.tps_amount ?? undefined,
        tvq_amount: reservation.tvq_amount ?? undefined,
        client_total: reservation.client_total ?? undefined,
        platform_subtotal: reservation.platform_subtotal ?? undefined,
        platform_tax_amount: reservation.platform_tax_amount ?? undefined,
        platform_total_retained: reservation.platform_total_retained ?? undefined,
        station_subtotal: reservation.station_subtotal ?? undefined,
        station_tax_amount: reservation.station_tax_amount ?? undefined,
        station_total_transferred: reservation.station_total_transferred ?? undefined,
        stripe_payment_id: newStripePaymentId,
      },
      tx
    );

    // Stamp confirmed_at only when the new entry is actually confirmed.
    const newEntryRow = newStatus === 'confirmed'
      ? await updateEntry(created.id, { confirmed_at: new Date() }, tx)
      : created;

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
      let captureResult: Awaited<ReturnType<typeof capturePaymentIntent>> | null = null;
      try {
        captureResult = await capturePaymentIntent(reservation.stripe_payment_id);
      } catch (e) {
        const err = classifyStripeError(e);
        console.error('[RESCHEDULE_CAPTURE_FAILED]', {
          reservationId,
          stripe_payment_id: reservation.stripe_payment_id,
          error_class: err.class,
          error_code: err.code,
          error: err.message,
        });
      }

      if (!captureResult) {
        // A non-recoverable Stripe error (network, invalid request) prevented capture.
        // Creating a new PI now would leave two active authorizations on the client's card.
        // Abort so the caller returns a 5xx and the client can retry.
        throw new Error(
          `[RESCHEDULE_CAPTURE_FAILED] Could not capture original PaymentIntent ${reservation.stripe_payment_id} — reschedule aborted to prevent double charge. Manual resolution required for reservation ${reservationId}.`
        );
      }

      // charged=false: PI was already cancelled (expired). No funds moved — skip penalty/refund
      // and proceed directly to creating a new PI at the standard (non-late) rate.
      const charged = captureResult.charged;
      const chargeId = captureResult.chargeId;
      const transferId = captureResult.transferId;

      if (charged && chargeId) {
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

      if (charged && transferId) {
        // Persist stripe_transfer_id on the now-cancelled original reservation so a future
        // dispute refund (rare, since the old row is cancelled) correctly bills the station.
        await setStripeTransferIdIfMissing(reservationId, transferId).catch((e) => {
          console.error('[RESCHEDULE_TRANSFER_ID_PERSIST_FAILED]', {
            reservationId,
            transferId,
            error: e instanceof Error ? e.message : String(e),
          });
        });
      }

      if (charged && refundedAmount > 0) {
        try {
          const refundId = await refundPaymentIntent(
            reservation.stripe_payment_id,
            Math.round(refundedAmount * 100),
            `rescheduled-refund:${reservationId}`
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

      if (charged && penaltyAmount > 0) {
        try {
          const stationTransferCents = Math.round(parseFloat(reservation.station_payout ?? '0') * 100);
          await distributePenalty(
            reservation.stripe_payment_id,
            Math.round(penaltyAmount * 100),
            stationTransferCents,
            policy.stationPenaltyShare,
            `rescheduled-penalty:${reservationId}`,
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

    // A new PaymentIntent requires the station's Stripe Connect account. This is
    // the only branch that needs it, so a free reschedule (Case 1) can proceed
    // even for a station without a payment account configured.
    if (!stationStripeAccountId) {
      throw new ConflictError('Station has no payment account configured');
    }

    // Create a new PaymentIntent for the rescheduled reservation.
    const clientTotal = parseFloat(
      reservation.client_total ?? reservation.amount_paid
    );
    const platformTotalRetained = parseFloat(
      reservation.platform_total_retained ?? reservation.commission_amount ?? '0'
    );
    const amountCents = Math.round(clientTotal * 100);
    const applicationFeeAmountCents = Math.round(platformTotalRetained * 100);

    try {
      const { paymentIntentId, clientSecret: cs } = await createPaymentIntent({
        amountCents,
        userId,
        stationId: reservation.station_id,
        stationStripeAccountId,
        applicationFeeAmountCents,
        metadata: {
          reservation_id: newEntry.id,
          time_slot_id: newTimeSlotId,
          vehicle_format_id: reservation.vehicle_format_id ?? '',
          rescheduled_from: reservationId,
        },
      });
      await updateEntry(newEntry.id, { stripe_payment_id: paymentIntentId });
      clientSecret = cs;
    } catch (e) {
      // New PI failed: new reservation is stuck in pending_payment with no stripe_payment_id.
      // Log for manual resolution - do not silently swallow.
      console.error('[RESCHEDULE_NEW_PI_FAILED] New PaymentIntent creation failed - manual resolution required', {
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
    await notifyClientFeed({
      userId,
      entryId: newEntry.id,
      stationId: reservation.station_id,
      kind: 'reservation_rescheduled',
      body: 'Votre réservation a été déplacée vers un nouveau créneau.',
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
