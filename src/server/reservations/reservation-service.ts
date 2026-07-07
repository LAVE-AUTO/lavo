/**
 * Reservation business logic: create reservation, cancel, list my entries, upgrade queue to reservation.
 *
 * Core operations:
 *   - createReservation: new booking with Stripe PaymentIntent and atomic slot check
 *   - cancelReservation: cancel with optional refund or late-cancellation penalty handling
 *   - listMyReservations / listStationReservations: paginated entry listings
 *   - onStripePaymentSucceeded: mark entry as confirmed when payment captured
 *
 * Dependencies:
 *   - Entry repository (CRUD operations on reservation entries)
 *   - Slot repository (booked_count tracking, SELECT FOR UPDATE locking)
 *   - Station config (surcharge read)
 *   - Stripe PaymentIntent (Connect charges)
 *   - Notifications (fire-and-forget entry updates)
 */

import { NotFoundError, ConflictError, ActiveReservationExistsError, SlotFullError, ValidationError, InvalidTicketCodeError } from '@/lib/errors';
import { getPlatformSettingWithFallback, getCancellationPolicy } from '@/server/admin/platform-settings-service';
import { db } from '@/lib/db';
import { getConfigByStationId } from '@/server/station/config-repository';
import { findServiceVehicleEntryForBooking, findServiceByIdAndStation, findEnrichedService } from '@/server/station/service-repository';
import { findFormatById } from '@/server/station/format-repository';
import {
  lockSlotForUpdate,
  countReservationsBySlotId,
  incrementSlotBookedCount,
  decrementSlotBookedCount,
} from '@/server/station/slot-repository';
import { createPaymentIntent, cancelPaymentIntent, capturePaymentIntent, classifyStripeError, refundPaymentIntent, distributePenalty, updatePaymentIntentMetadata } from '@/server/payments/payment-service';
import { logFinancialEvent } from '@/server/payments/financial-event-logger';
import { cancelReservation } from '@/server/reservations/cancellation-service';
import { findById, findByEmail } from '@/server/auth/user-repository';
import { notifyEntry } from '@/server/notifications/notification-service';
import { notifyStationFeed } from '@/server/notifications/station-feed-notifications';
import { notifyClientFeed } from '@/server/notifications/client-feed-notifications';
import { sendEscrowReleasedNotificationsForEntry } from '@/server/notifications/escrow-released-notifications';
import { sendWalkInReceiptEmail } from '@/lib/email';
import { findStationById } from '@/server/station/station-repository';
import { findMatchingAvailabilitySlot } from '@/server/station/post-availability-service';
import { generateTicketCode } from './ticket-code';
import { and, eq as eqInline, sql as sqlInline } from 'drizzle-orm';
import { reservations as reservationsTableModule, timeSlots as timeSlotsTable } from '@/lib/db/schema';
import {
  createReservationEntry,
  createQueueEntry,
  findEntryById,
  findEntryByIdAndUser,
  findEntryByIdAndStation,
  hasActiveReservationForSlot,
  findPendingPaymentReservationForSlot,
  clearStripePaymentSucceededNotifiedAt,
  markPiCancelFailed,
  setStripePaymentSucceededNotifiedAtIfMissing,
  setStripeTransferIdIfMissing,
  updateEntry,
  shiftQueuePositions,
  repositionQueueEntry,
  getNextQueuePosition,
  listRichEntriesByUser,
  findRichEntryByIdAndUser,
  listRichStationEntriesPaginated,
  type Entry,
  type ListEntriesFilters,
  type PaginatedEntries,
  type RichEntry,
  type RichStationEntry,
  listEntriesByUserPaginated,
  listEntriesByStationPaginated,
  cancelExpiredPendingPaymentsForSlot,
} from './entry-repository';
import { computeReservationSplit } from './compute-reservation-split';
import { verifyQrToken } from '@/server/qr/qr-token-service';
import { refreshStationStats } from '@/server/station/station-stats-service';
import { findApplicablePromotionForUserReservation } from '@/server/station/station-promotion-service';


const STATUS_PENDING_PAYMENT = 'pending_payment';
const STATUS_CANCELLED = 'cancelled';
const STATUS_CONFIRMED = 'confirmed';


function toDecimal(v: string | number): string {
  return typeof v === 'number' ? v.toFixed(2) : String(v);
}

function parseDecimal(s: string | null | undefined): number {
  if (s == null) return 0;
  const n = parseFloat(String(s));
  return Number.isFinite(n) ? n : 0;
}

function mapSplitToEntryFinancialSnapshot(split: Awaited<ReturnType<typeof computeReservationSplit>>) {
  return {
    amount_paid: toDecimal(split.client_total),
    commission_rate: split.commissionRate,
    commission_amount: toDecimal(split.commissionAmount),
    station_payout: toDecimal(split.station_total_transferred),
    station_service_total: toDecimal(split.station_service_total),
    platform_service_fee: toDecimal(split.platform_service_fee),
    taxable_subtotal: toDecimal(split.taxable_subtotal),
    tps_amount: toDecimal(split.tps_amount),
    tvq_amount: toDecimal(split.tvq_amount),
    client_total: toDecimal(split.client_total),
    platform_subtotal: toDecimal(split.platform_subtotal),
    platform_tax_amount: toDecimal(split.platform_tax_amount),
    platform_total_retained: toDecimal(split.platform_total_retained),
    station_subtotal: toDecimal(split.station_subtotal),
    station_tax_amount: toDecimal(split.station_tax_amount),
    station_total_transferred: toDecimal(split.station_total_transferred),
  };
}

/**
 * Reads the max advance booking days setting and returns the cutoff in milliseconds.
 * Stripe card authorizations expire after 7 days, so bookings beyond this window must be rejected.
 */
async function getMaxAdvanceBookingMs(): Promise<{ maxDays: number; maxAdvanceMs: number }> {
  const raw = parseInt(
    await getPlatformSettingWithFallback('max_advance_booking_days', 'PLATFORM_MAX_ADVANCE_BOOKING_DAYS', '7'),
    10
  );
  const maxDays = Number.isFinite(raw) && raw >= 1 ? raw : 7;
  return { maxDays, maxAdvanceMs: maxDays * 24 * 60 * 60 * 1000 };
}

/**
 * Resolves the total amount for a reservation using the service vehicle entry price + optional station surcharge.
 */
async function resolveReservationAmount(
  serviceId: string,
  vehicleFormatId: string | null | undefined,
  stationId: string
): Promise<{ vehicleEntry: Awaited<ReturnType<typeof findServiceVehicleEntryForBooking>>; amountTotal: number }> {
  const vehicleEntry = await findServiceVehicleEntryForBooking(serviceId, vehicleFormatId ?? null);
  if (!vehicleEntry) throw new NotFoundError('Service pricing entry not found for this format');

  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge
    ? parseDecimal(String(config.reservation_surcharge))
    : 0;
  const amountTotal = parseDecimal(String(vehicleEntry.price)) + surcharge;
  if (amountTotal <= 0) throw new ConflictError('Invalid amount');

  return { vehicleEntry, amountTotal };
}


/**
 * Result of createReservation operation.
 * Includes the created entry and Stripe client_secret for frontend payment UI.
 */
export type CreateReservationResult = {
  entry: Entry;
  clientSecret: string;
};

/**
 * Result of cancelEntry operation.
 * Financial fields (refundedAmount, penaltyAmount) are only present for confirmed reservations
 * that triggered a Stripe refund or a late-cancellation penalty calculation.
 */
export type CancelEntryResult = {
  entry: Entry;
  refundedAmount?: number;
  penaltyAmount?: number;
  isLateCancellation?: boolean;
};


/**
 * Creates a new reservation for the given time slot and vehicle format.
 *
 * Stripe-first pattern: PI is created before the DB transaction so there is no crash window
 * where an entry exists with stripe_payment_id = null. If the DB transaction fails (slot full,
 * duplicate, etc.), the PI is never returned to the client and auto-expires on Stripe after 24h -
 * no charge, no orphan, no rollback needed.
 *
 * Full flow:
 * 1. Validate vehicle format and station config (surcharge)
 * 2. QR token validation
 * 3. Create Stripe PaymentIntent (before DB - Stripe-first)
 * 4. Atomic transaction:
 *    - Duplicate check (SELECT FOR UPDATE on slot prevents TOCTOU)
 *    - Lock slot, verify capacity, enforce max advance booking window
 *    - Insert entry with stripe_payment_id already set, increment slot booked_count
 * 5. Update PI metadata with reservation_id (non-fatal - informational only)
 * 6. Send notification to client
 *
 * @param userId - Client UUID
 * @param stationId - Station UUID
 * @param stationStripeAccountId - Stripe Connect account for destination charge
 * @param timeSlotId - Time slot UUID
 * @param vehicleFormatId - Vehicle format UUID
 * @param options - Optional QR booking context (token + version for kiosk bookings)
 * @returns CreateReservationResult with entry and Stripe client_secret
 * @throws NotFoundError - format or slot not found
 * @throws ConflictError - invalid amount, active reservation exists, or booking window exceeded
 * @throws SlotFullError - slot at capacity
 * @throws ValidationError - invalid QR booking token
 */
export async function createReservation(
  userId: string,
  stationId: string,
  stationStripeAccountId: string,
  timeSlotId: string,
  serviceId: string,
  vehicleFormatId: string | null | undefined,
  options?: { qrToken?: string; qrVersion?: string }
): Promise<CreateReservationResult> {
  const service = await findServiceByIdAndStation(serviceId, stationId);
  if (!service) throw new NotFoundError('Service not found');

  const { amountTotal } = await resolveReservationAmount(serviceId, vehicleFormatId, stationId);

  const hasQrPayload = Boolean(options?.qrToken || options?.qrVersion);
  const qrValidation = options?.qrToken
    ? verifyQrToken({
        stationId,
        qrToken: options.qrToken,
        version: options.qrVersion,
      })
    : { isValid: false as const, reason: undefined };
  const isQrBooking = Boolean(options?.qrToken) && qrValidation.isValid;
  if (hasQrPayload && !isQrBooking) {
    throw new ValidationError('Invalid QR booking token context');
  }

  const applicablePromotion = !isQrBooking
    ? await findApplicablePromotionForUserReservation(userId, stationId)
    : null;
  const split = await computeReservationSplit({
    amountTotal,
    isQrBooking,
    promotionReductionRate: applicablePromotion?.commission_rate ?? null,
  });

  const amountCents = Math.round(split.client_total * 100);
  const applicationFeeAmountCents = Math.round(split.platform_total_retained * 100);

  // Cancel any stale pending_payment entry for this user+slot before creating a new PI.
  // This lets users retry after abandoning the Stripe form without hitting a duplicate error.
  //
  // Use a guarded UPDATE so two concurrent retries don't both attempt to cancel the same PI
  // and don't both reach the "create new PI" step thinking they own the cleanup (bug #8 sibling).
  const stalePending = await findPendingPaymentReservationForSlot(userId, timeSlotId);
  if (stalePending) {
    let stripePaymentIdToCancel: string | null = null;
    await db.transaction(async (tx) => {
      const [row] = await tx
        .update(reservationsTableModule)
        .set({ status: 'payment_failed', updated_at: new Date() })
        .where(
          and(
            eqInline(reservationsTableModule.id, stalePending.id),
            eqInline(reservationsTableModule.status, 'pending_payment')
          )
        )
        .returning({
          id: reservationsTableModule.id,
          stripe_payment_id: reservationsTableModule.stripe_payment_id,
        });
      if (row) stripePaymentIdToCancel = row.stripe_payment_id;
    });
    if (stripePaymentIdToCancel) {
      try {
        await cancelPaymentIntent(stripePaymentIdToCancel);
      } catch {
        // Non-fatal: PI may already be expired or cancelled by Stripe
      }
    }
  }

  // Create Stripe PaymentIntent before the DB transaction (Stripe-first pattern).
  // reservation_id is set via a non-fatal metadata update after DB commit.
  // Idempotency key: scoped to (user, slot, service, vehicle, minute). A network-retry
  // from the client within the same minute returns the same PI instead of producing a
  // second authorization hold on the card.
  const piIdempotencyKey = `pi-create:reservation:${userId}:${timeSlotId}:${serviceId}:${vehicleFormatId ?? 'na'}:${Math.floor(Date.now() / 60_000)}`;
  const { paymentIntentId, clientSecret } = await createPaymentIntent({
    amountCents,
    userId,
    stationId,
    stationStripeAccountId,
    applicationFeeAmountCents,
    idempotencyKey: piIdempotencyKey,
    metadata: {
      time_slot_id: timeSlotId,
      service_id: serviceId,
      vehicle_format_id: vehicleFormatId ?? '',
    },
  });

  // Atomic: expire stale pending_payment entries, duplicate check, slot lock, capacity check,
  // entry insert, slot increment. Entry is created with stripe_payment_id already set — no orphan window.
  let expiredPiIds: string[] = [];
  const entry = await db.transaction(async (tx) => {
    // Free slots held by pending_payment entries older than PENDING_PAYMENT_TTL_MS (30 min).
    // Runs inside the transaction so booked_count decrements are atomic with the capacity check.
    // Stripe PI cancellations happen outside, after commit, to avoid external calls in a transaction.
    const expired = await cancelExpiredPendingPaymentsForSlot(timeSlotId, tx);
    for (const row of expired) {
      await decrementSlotBookedCount(timeSlotId, tx);
      if (row.stripe_payment_id) expiredPiIds.push(row.stripe_payment_id);
    }

    const hasActive = await hasActiveReservationForSlot(userId, timeSlotId, tx);
    if (hasActive) throw new ActiveReservationExistsError();

    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    // Stripe card authorizations expire after 7 days - reject bookings beyond this window.
    const { maxDays, maxAdvanceMs } = await getMaxAdvanceBookingMs();
    if (slot.start_time.getTime() - Date.now() > maxAdvanceMs) {
      throw new ConflictError(`Reservations cannot be made more than ${maxDays} days in advance`);
    }

    const count = await countReservationsBySlotId(timeSlotId, tx);
    if (count >= (slot.capacity ?? 0)) throw new SlotFullError();

    const created = await createReservationEntry(
      {
        user_id: userId,
        station_id: stationId,
        vehicle_format_id: vehicleFormatId ?? null,
        service_id: serviceId,
        time_slot_id: timeSlotId,
        status: STATUS_PENDING_PAYMENT,
        booking_source: split.bookingSource,
        ...mapSplitToEntryFinancialSnapshot(split),
        stripe_payment_id: paymentIntentId,
        ticket_code: generateTicketCode(),
      },
      tx
    );
    await incrementSlotBookedCount(timeSlotId, tx);
    return created;
  });

  // Cancel Stripe PIs for expired entries outside the transaction (no external calls inside tx).
  for (const piId of expiredPiIds) {
    cancelPaymentIntent(piId).catch(() => {});
  }

  // Update PI metadata with reservation_id now that the entry ID is known.
  // Non-fatal: metadata is informational only; webhook resolution uses stripe_payment_id on the entry.
  try {
    await updatePaymentIntentMetadata(paymentIntentId, { reservation_id: entry.id });
  } catch (e) {
    console.error('[CREATE_RESERVATION] PI metadata update failed - non-fatal', {
      entryId: entry.id,
      paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Notifications are intentionally deferred to the Stripe webhook handler
  // (payment_intent.amount_capturable_updated). Sending them here would notify
  // the client and station for reservations whose payment ultimately fails.

  return { entry, clientSecret };
}


/**
 * Creates a reservation from a `start_time` chosen against the per-post
 * availability endpoint. Picks the first active post that is still free at
 * that exact start_time, locks it, re-verifies availability, and inserts a
 * one-shot time_slot + reservation pair.
 *
 * Throws:
 *   - NotFoundError       service / vehicle format missing
 *   - SlotFullError       no free post at this time anymore
 *   - ConflictError       window beyond Stripe auth horizon
 *   - ValidationError     bad QR token context
 */
export async function createReservationByStartTime(
  userId: string,
  stationId: string,
  stationStripeAccountId: string,
  startTimeIso: string,
  serviceId: string,
  vehicleFormatId: string | null | undefined,
  options?: { qrToken?: string; qrVersion?: string }
): Promise<CreateReservationResult> {
  const service = await findServiceByIdAndStation(serviceId, stationId);
  if (!service) throw new NotFoundError('Service not found');

  const { amountTotal, vehicleEntry } = await resolveReservationAmount(serviceId, vehicleFormatId, stationId);
  const durationMin = vehicleEntry?.duration_min ?? 30;

  /* Pre-check (cheap, non-locking): make sure at least one post is free at
   * `startTime`. We let the transactional re-check decide the final post. */
  const preMatch = await findMatchingAvailabilitySlot(stationId, startTimeIso, durationMin);
  if (!preMatch) throw new SlotFullError();

  const startTime = new Date(startTimeIso);
  const endTime = new Date(startTime.getTime() + durationMin * 60_000);

  /* Stripe authorization horizon. */
  const { maxDays, maxAdvanceMs } = await getMaxAdvanceBookingMs();
  if (startTime.getTime() - Date.now() > maxAdvanceMs) {
    throw new ConflictError(`Reservations cannot be made more than ${maxDays} days in advance`);
  }

  const hasQrPayload = Boolean(options?.qrToken || options?.qrVersion);
  const qrValidation = options?.qrToken
    ? verifyQrToken({ stationId, qrToken: options.qrToken, version: options.qrVersion })
    : { isValid: false as const, reason: undefined };
  const isQrBooking = Boolean(options?.qrToken) && qrValidation.isValid;
  if (hasQrPayload && !isQrBooking) {
    throw new ValidationError('Invalid QR booking token context');
  }

  const applicablePromotion = !isQrBooking
    ? await findApplicablePromotionForUserReservation(userId, stationId)
    : null;
  const split = await computeReservationSplit({
    amountTotal,
    isQrBooking,
    promotionReductionRate: applicablePromotion?.commission_rate ?? null,
  });
  const amountCents = Math.round(split.client_total * 100);
  const applicationFeeAmountCents = Math.round(split.platform_total_retained * 100);

  /* Stripe-first: create PI before the DB transaction. If the txn fails,
   * the PI auto-expires after 24h (never charged).
   * Idempotency key: (user, station, service, vehicle, start_time, minute). A retry
   * within the same minute returns the same PI rather than producing a second card hold. */
  const piIdempotencyKey = `pi-create:reservation-start:${userId}:${stationId}:${serviceId}:${vehicleFormatId ?? 'na'}:${startTime.getTime()}:${Math.floor(Date.now() / 60_000)}`;
  const { paymentIntentId, clientSecret } = await createPaymentIntent({
    amountCents,
    userId,
    stationId,
    stationStripeAccountId,
    applicationFeeAmountCents,
    idempotencyKey: piIdempotencyKey,
    metadata: {
      service_id: serviceId,
      vehicle_format_id: vehicleFormatId ?? '',
      start_time: startTime.toISOString(),
    },
  });

  const entry = await db.transaction(async (tx) => {
    /* Lock all active posts of the station to serialise concurrent bookings.
     * Only a few rows per station, so the lock is short-lived. */
    await tx.execute(
      sqlInline`SELECT id FROM station_posts WHERE station_id = ${stationId} AND is_active = true FOR UPDATE`
    );

    const fresh = await findMatchingAvailabilitySlot(stationId, startTimeIso, durationMin);
    if (!fresh) throw new SlotFullError();

    /* Insert the one-shot time_slot. capacity = 1 because the post-level
     * model already enforces single-booking per slot. */
    const [slot] = await tx
      .insert(timeSlotsTable)
      .values({
        station_id: stationId,
        start_time: startTime,
        end_time: endTime,
        capacity: 1,
        booked_count: 1,
        status: 'available',
      })
      .returning();
    if (!slot) throw new Error('Insert time slot failed');

    return createReservationEntry(
      {
        user_id: userId,
        station_id: stationId,
        vehicle_format_id: vehicleFormatId ?? null,
        service_id: serviceId,
        post_id: fresh.post_id,
        time_slot_id: slot.id,
        status: STATUS_PENDING_PAYMENT,
        booking_source: split.bookingSource,
        ...mapSplitToEntryFinancialSnapshot(split),
        stripe_payment_id: paymentIntentId,
        ticket_code: generateTicketCode(),
      },
      tx
    );
  });

  try {
    await updatePaymentIntentMetadata(paymentIntentId, { reservation_id: entry.id });
  } catch (e) {
    console.error('[CREATE_RESERVATION_BY_START_TIME] PI metadata update failed - non-fatal', {
      entryId: entry.id,
      paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Notifications deferred to Stripe webhook — see createReservation comment above.

  return { entry, clientSecret };
}


/**
 * Unified entry cancellation for PATCH /me/entries/:entryId/cancel.
 * Handles all entry types and statuses:
 *
 * - Confirmed reservation (paid): delegates to cancelReservation() for full Stripe refund
 *   + penalty policy. Returns financial details in the result.
 * - Pending payment reservation: cancels the Stripe PaymentIntent, decrements slot.
 * - Queue entry: shifts positions, no Stripe interaction.
 */
export async function cancelEntry(
  entryId: string,
  userId: string,
  reason?: string
): Promise<CancelEntryResult> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');

  // Confirmed reservations: full cancellation with Stripe refund and penalty policy.
  if (entry.entry_type === 'reservation' && entry.status === STATUS_CONFIRMED) {
    const client = await findById(userId);
    const clientName = client?.first_name ?? 'Un client';
    const result = await cancelReservation(entryId, userId, reason);
    await notifyStationFeed({
      stationId: entry.station_id,
      entryId,
      kind: 'reservation_cancelled_by_client',
      body: `${clientName} a annulé sa réservation (${toDecimal(entry.amount_paid)} $)`,
    });
    return {
      entry: result.entry,
      refundedAmount: result.refundedAmount,
      penaltyAmount: result.penaltyAmount,
      isLateCancellation: result.isLateCancellation,
    };
  }

  // Queue entry with authorized (not yet captured) payment: apply cancellation fees.
  // pending_payment = Stripe has not confirmed yet → just cancel the PI (no charge).
  // in_progress = already being served → cannot self-cancel via this path.
  if (
    entry.entry_type === 'queue' &&
    entry.stripe_payment_id &&
    entry.status !== STATUS_PENDING_PAYMENT &&
    entry.status !== 'in_progress'
  ) {
    const policy = await getCancellationPolicy();

    // Compute penalty and refund amounts inside the transaction so they are derived from the
    // transactionally-consistent amount_paid. Return them from the transaction (rather than
    // mutating `let` bindings outside) so a transaction rollback never leaves stale values
    // visible to the Stripe block below (bug #15).
    const { entry: updated, penaltyAmount, refundedAmount } = await db.transaction(async (tx) => {
      const current = await findEntryByIdAndUser(entryId, userId, tx);
      if (!current) throw new NotFoundError('Entry not found');
      if (current.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');

      // Defensive: amount_paid comes from the DB as a string. Clamp to a non-negative
      // finite number so a corrupt / migrated row cannot produce negative Stripe cents.
      const rawAmount = parseFloat(String(current.amount_paid));
      const amountPaid = Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0;
      const computedPenalty = Math.max(
        0,
        Math.round(amountPaid * policy.penaltyRate * 100) / 100
      );
      const computedRefund = Math.max(
        0,
        Math.round((amountPaid - computedPenalty) * 100) / 100
      );

      if (current.entry_type === 'queue' && current.queue_position != null) {
        await shiftQueuePositions(current.station_id, current.queue_position + 1, -1, tx);
      }
      const row = await updateEntry(
        entryId,
        {
          status: STATUS_CANCELLED,
          cancellation_reason: reason ?? null,
          penalty_amount: computedPenalty > 0 ? computedPenalty.toFixed(2) : null,
        },
        tx
      );
      return { entry: row, penaltyAmount: computedPenalty, refundedAmount: computedRefund };
    });

    // Stripe: capture full amount → partial refund → distribute penalty share.
    // Kept outside the transaction: Stripe calls must not hold DB locks.
    let captureResult: Awaited<ReturnType<typeof capturePaymentIntent>> | null = null;
    try {
      captureResult = await capturePaymentIntent(entry.stripe_payment_id);
    } catch (e) {
      const err = classifyStripeError(e);
      console.error('[QUEUE_CANCEL_CAPTURE_FAILED]', {
        entryId,
        stripe_payment_id: entry.stripe_payment_id,
        error_class: err.class,
        error_code: err.code,
        error: err.message,
      });
    }
    const charged = captureResult?.charged ?? false;
    const chargeId = captureResult?.chargeId ?? null;
    const transferId = captureResult?.transferId ?? null;
    if (charged && chargeId) {
      try {
        await updateEntry(entryId, { stripe_charge_id: chargeId });
      } catch (e) {
        console.error('[QUEUE_CANCEL_STRIPE_CHARGE_ID_UPDATE_FAILED]', {
          entryId,
          chargeId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (charged && transferId) {
      // Persist transfer_id so a subsequent admin dispute refund correctly bills the station.
      await setStripeTransferIdIfMissing(entryId, transferId).catch((e) => {
        console.error('[QUEUE_CANCEL_TRANSFER_ID_PERSIST_FAILED]', {
          entryId,
          transferId,
          error: e instanceof Error ? e.message : String(e),
        });
      });
    }
    if (charged && refundedAmount > 0) {
      try {
        const refundId = await refundPaymentIntent(
          entry.stripe_payment_id,
          Math.round(refundedAmount * 100),
          `queue-cancel-refund:${entryId}`
        );
        await updateEntry(entryId, { stripe_refund_id: refundId });
      } catch (e) {
        console.error('[QUEUE_CANCEL_REFUND_FAILED]', {
          entryId,
          stripe_payment_id: entry.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    if (charged && penaltyAmount > 0) {
      try {
        const stationTransferCents = Math.round(parseFloat(entry.station_payout ?? '0') * 100);
        await distributePenalty(
          entry.stripe_payment_id,
          Math.round(penaltyAmount * 100),
          stationTransferCents,
          policy.stationPenaltyShare,
          `queue-cancel-penalty:${entryId}`,
          chargeId ?? undefined,
          transferId ?? undefined,
        );
      } catch (e) {
        console.error('[QUEUE_CANCEL_PENALTY_DIST_FAILED]', {
          entryId,
          stripe_payment_id: entry.stripe_payment_id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    const client = await findById(userId);
    const clientName = client?.first_name ?? 'Un client';
    await notifyEntry({
      entryId,
      userId,
      stationId: entry.station_id,
      type: 'queue_cancelled_by_client',
      payload: { penaltyAmount, refundedAmount },
    });
    await notifyClientFeed({
      userId,
      entryId,
      stationId: entry.station_id,
      kind: 'queue_cancelled_by_client',
      body: "Vous avez annulé votre place dans la file d'attente.",
    });
    await notifyStationFeed({
      stationId: entry.station_id,
      entryId,
      kind: 'queue_cancelled_by_client',
      body: `${clientName} a annulé sa place en file (${toDecimal(entry.amount_paid)} $)`,
    });
    return { entry: updated, penaltyAmount, refundedAmount, isLateCancellation: true };
  }

  // Queue entry with no payment or pending_payment reservation: simple cancellation.
  const updated = await db.transaction(async (tx) => {
    const current = await findEntryByIdAndUser(entryId, userId, tx);
    if (!current) throw new NotFoundError('Entry not found');
    if (current.status === STATUS_CANCELLED) throw new ConflictError('Entry already cancelled');

    if (current.entry_type === 'reservation' && current.time_slot_id) {
      await decrementSlotBookedCount(current.time_slot_id, tx);
    }
    if (current.entry_type === 'queue' && current.queue_position != null) {
      await shiftQueuePositions(current.station_id, current.queue_position + 1, -1, tx);
    }
    return updateEntry(entryId, { status: STATUS_CANCELLED }, tx);
  });

  // Cancel the PaymentIntent if payment hasn't been confirmed yet (no charge).
  // On failure emit PI_CANCEL_FAILED for ops visibility (bug #12).
  if (entry.stripe_payment_id && entry.status === STATUS_PENDING_PAYMENT) {
    try {
      await cancelPaymentIntent(entry.stripe_payment_id);
    } catch (e) {
      const err = classifyStripeError(e);
      console.error('[CANCEL_PAYMENT_INTENT_FAILED]', {
        entryId,
        error_class: err.class,
        error_code: err.code,
        error: err.message,
      });
      logFinancialEvent({
        event: 'PI_CANCEL_FAILED',
        stripePaymentIntentId: entry.stripe_payment_id,
        entryId,
        userId,
        stationId: entry.station_id,
        meta: {
          error_class: err.class,
          error_code: err.code ?? null,
          context: 'unified_entry_cancel',
        },
      });
      await markPiCancelFailed(entryId).catch(() => undefined);
    }
  }

  const client = await findById(userId);
  const clientName = client?.first_name ?? 'Un client';
  await notifyEntry({
    entryId,
    userId,
    stationId: entry.station_id,
    type: 'entry_cancelled',
  });
  await notifyClientFeed({
    userId,
    entryId,
    stationId: entry.station_id,
    kind: 'entry_cancelled',
    body: "Votre réservation a été annulée.",
  });
  await notifyStationFeed({
    stationId: entry.station_id,
    entryId,
    kind: entry.entry_type === 'reservation' ? 'reservation_cancelled_by_client' : 'queue_cancelled_by_client',
    body: entry.entry_type === 'reservation'
      ? `${clientName} a annulé sa réservation (${toDecimal(entry.amount_paid)} $)`
      : `${clientName} a annulé sa place en file (${toDecimal(entry.amount_paid)} $)`,
  });
  return { entry: updated };
}


/**
 * Confirms the client's presence for a reservation.
 * Only allowed for reservations in 'confirmed' status owned by the user.
 * Sets client_confirmed = true. Returns 409 if already confirmed.
 */
export async function confirmPresence(reservationId: string, userId: string): Promise<Entry> {
  const entry = await findEntryByIdAndUser(reservationId, userId);
  if (!entry) throw new NotFoundError('Reservation not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (entry.status !== 'confirmed') throw new ConflictError(`Cannot confirm presence for a reservation with status '${entry.status}'`);
  if (entry.client_confirmed) throw new ConflictError('Presence already confirmed');
  return updateEntry(reservationId, { client_confirmed: true });
}


/**
 * Returns paginated entries (reservations and queue) for the user.
 */
export async function listMyEntries(
  userId: string,
  filters?: ListEntriesFilters
): Promise<PaginatedEntries> {
  return listEntriesByUserPaginated(userId, filters);
}

/**
 * Returns paginated rich entries for the user, including denormalized station,
 * vehicle format, is_rated, is_tipped, and estimated_wait_minutes.
 */
export async function listMyRichEntries(
  userId: string,
  filters?: ListEntriesFilters
): Promise<{ rows: RichEntry[]; total: number; page: number; per_page: number }> {
  return listRichEntriesByUser(userId, filters);
}

/**
 * Returns a single rich entry by id with ownership check. Returns undefined when not found.
 */
export async function getMyRichEntry(
  entryId: string,
  userId: string
): Promise<RichEntry | undefined> {
  return findRichEntryByIdAndUser(entryId, userId);
}

/**
 * Returns paginated entries for the station.
 */
export async function listStationEntries(
  stationId: string,
  filters?: ListEntriesFilters
): Promise<PaginatedEntries> {
  return listEntriesByStationPaginated(stationId, filters);
}

/**
 * Returns paginated station entries enriched with user first_name and vehicle format.
 */
export async function listRichStationEntries(
  stationId: string,
  filters?: ListEntriesFilters
): Promise<{ rows: RichStationEntry[]; total: number; page: number; per_page: number }> {
  return listRichStationEntriesPaginated(stationId, filters);
}


/** Result of upgradeQueueToReservation: updated entry + Stripe client_secret for frontend payment. */
export type UpgradeToReservationResult = {
  entry: Entry;
  clientSecret: string;
};

/**
 * Upgrades a queue entry to a reservation by assigning a time slot and initiating payment.
 *
 * Stripe-first pattern: PI is created before the DB transaction so there is no crash window
 * where an entry exists with stripe_payment_id = null. If the DB transaction fails (slot full,
 * advance booking limit, etc.), the PI is never returned to the client and auto-expires on
 * Stripe after 24h - no charge, no orphan, no rollback needed.
 *
 * Flow:
 * 1. Validate entry is a queue entry belonging to the user at the given station.
 * 2. Resolve price: vehicle format price + optional reservation surcharge.
 * 3. Create Stripe PaymentIntent (before DB - Stripe-first).
 * 4. Atomic transaction: lock slot, verify capacity, shift queue positions, convert entry to
 *    reservation (pending_payment) with stripe_payment_id already set, increment slot booked_count.
 * 5. Update PI metadata with reservation_id (non-fatal - informational only).
 * 6. Return entry + client_secret for frontend payment confirmation.
 */
export async function upgradeQueueToReservation(
  entryId: string,
  userId: string,
  timeSlotId: string,
  stationId: string,
  stationStripeAccountId: string
): Promise<UpgradeToReservationResult> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');
  if (entry.station_id !== stationId) throw new NotFoundError('Entry does not belong to this station');

  // Price = original queue amount + optional reservation surcharge.
  // The queue's service_id stays attached to the upgraded reservation row.
  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge ? parseDecimal(String(config.reservation_surcharge)) : 0;
  const amountTotal = parseDecimal(String(entry.station_service_total)) + surcharge;
  if (amountTotal <= 0) throw new ConflictError('Invalid amount for upgrade');

  const applicablePromotion = await findApplicablePromotionForUserReservation(userId, stationId);
  const split = await computeReservationSplit({
    amountTotal,
    isQrBooking: false,
    promotionReductionRate: applicablePromotion?.commission_rate ?? null,
  });

  const amountCents = Math.round(split.client_total * 100);
  const applicationFeeAmountCents = Math.round(split.platform_total_retained * 100);

  // Create Stripe PaymentIntent before the DB transaction (Stripe-first pattern).
  // entryId is known at this point (queue entry being upgraded), so we can derive a stable
  // idempotency key — if the request times out and is retried, Stripe returns the same PI.
  const { paymentIntentId, clientSecret } = await createPaymentIntent({
    amountCents,
    userId,
    stationId,
    stationStripeAccountId,
    applicationFeeAmountCents,
    idempotencyKey: `pi-create:upgrade:${entryId}`,
    metadata: {
      time_slot_id: timeSlotId,
      vehicle_format_id: entry.vehicle_format_id ?? '',
      upgraded_from_queue: 'true',
    },
  });

  // Atomic: slot lock, capacity check, queue shift, entry conversion with stripe_payment_id already set.
  // On any DB error, cancel the PI that was already created to prevent Stripe orphans.
  const updated = await db.transaction(async (tx) => {
    const slot = await lockSlotForUpdate(timeSlotId, stationId, tx);
    if (!slot) throw new NotFoundError('Time slot not found or does not belong to this station');

    // Stripe card authorizations expire after 7 days.
    const { maxDays: maxDaysUpgrade, maxAdvanceMs } = await getMaxAdvanceBookingMs();
    if (slot.start_time.getTime() - Date.now() > maxAdvanceMs) {
      throw new ConflictError(`Reservations cannot be made more than ${maxDaysUpgrade} days in advance`);
    }

    const count = await countReservationsBySlotId(timeSlotId, tx);
    if (count >= (slot.capacity ?? 0)) throw new SlotFullError();

    const oldPosition = entry.queue_position ?? 0;
    await shiftQueuePositions(stationId, oldPosition + 1, -1, tx);
    const result = await updateEntry(
      entryId,
      {
        entry_type: 'reservation',
        time_slot_id: timeSlotId,
        queue_position: null,
        status: STATUS_PENDING_PAYMENT,
        booking_source: 'standard',
        ...mapSplitToEntryFinancialSnapshot(split),
        stripe_payment_id: paymentIntentId,
      },
      tx
    );
    await incrementSlotBookedCount(timeSlotId, tx);
    return result;
  }).catch(async (txError: unknown) => {
    try {
      await cancelPaymentIntent(paymentIntentId);
    } catch (cancelErr) {
      console.error('[UPGRADE_TO_RESERVATION] Failed to cancel orphaned PI after TX failure', {
        paymentIntentId,
        error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
      });
    }
    throw txError;
  });

  // Update PI metadata with reservation_id now that the entry ID is confirmed.
  // Non-fatal: metadata is informational only; webhook resolution uses stripe_payment_id on the entry.
  try {
    await updatePaymentIntentMetadata(paymentIntentId, { reservation_id: entryId });
  } catch (e) {
    console.error('[UPGRADE_TO_RESERVATION] PI metadata update failed - non-fatal', {
      entryId,
      paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const client = await findById(userId);
  const clientName = client?.first_name ?? 'Un client';
  await notifyEntry({
    entryId,
    userId,
    stationId,
    type: 'reservation_created',
  });
  await notifyClientFeed({
    userId,
    entryId,
    stationId,
    kind: 'reservation_created',
    body: 'Votre réservation a été enregistrée. Complétez le paiement pour confirmer.',
  });
  await notifyStationFeed({
    stationId,
    entryId,
    kind: 'queue_upgraded_to_reservation',
    body: `${clientName} a converti sa place en réservation (${amountTotal.toFixed(2)} $)`,
  });

  return { entry: updated, clientSecret };
}

/**
 * Upgrades a queue entry to a reservation using a dynamic `start_time` selected
 * from the per-post availability flow. This aligns queue upgrade UX with the
 * booking flow that relies on real-time availability (duration + opening window).
 */
export async function upgradeQueueToReservationByStartTime(
  entryId: string,
  userId: string,
  startTimeIso: string,
  stationId: string,
  stationStripeAccountId: string
): Promise<UpgradeToReservationResult> {
  const entry = await findEntryByIdAndUser(entryId, userId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');
  if (entry.station_id !== stationId) throw new NotFoundError('Entry does not belong to this station');

  const config = await getConfigByStationId(stationId);
  const surcharge = config?.reservation_surcharge ? parseDecimal(String(config.reservation_surcharge)) : 0;
  const amountTotal = parseDecimal(String(entry.station_service_total)) + surcharge;
  if (amountTotal <= 0) throw new ConflictError('Invalid amount for upgrade');

  const durationMin = Math.max(1, config?.wash_duration_minutes ?? 30);
  const preMatch = await findMatchingAvailabilitySlot(stationId, startTimeIso, durationMin);
  if (!preMatch) throw new SlotFullError();

  const startTime = new Date(startTimeIso);
  const endTime = new Date(startTime.getTime() + durationMin * 60_000);
  const { maxDays, maxAdvanceMs } = await getMaxAdvanceBookingMs();
  if (startTime.getTime() - Date.now() > maxAdvanceMs) {
    throw new ConflictError(`Reservations cannot be made more than ${maxDays} days in advance`);
  }

  const applicablePromotion = await findApplicablePromotionForUserReservation(userId, stationId);
  const split = await computeReservationSplit({
    amountTotal,
    isQrBooking: false,
    promotionReductionRate: applicablePromotion?.commission_rate ?? null,
  });
  const amountCents = Math.round(split.client_total * 100);
  const applicationFeeAmountCents = Math.round(split.platform_total_retained * 100);

  // Idempotency key: scoped to the queue entry being upgraded and the chosen start time, so
  // a network-retry returns the same PI instead of producing a second card authorization.
  const piIdempotencyKey = `pi-create:upgrade-start:${entryId}:${startTime.getTime()}`;
  const { paymentIntentId, clientSecret } = await createPaymentIntent({
    amountCents,
    userId,
    stationId,
    stationStripeAccountId,
    applicationFeeAmountCents,
    idempotencyKey: piIdempotencyKey,
    metadata: {
      vehicle_format_id: entry.vehicle_format_id ?? '',
      upgraded_from_queue: 'true',
      start_time: startTime.toISOString(),
    },
  });

  const updated = await db.transaction(async (tx) => {
    await tx.execute(
      sqlInline`SELECT id FROM station_posts WHERE station_id = ${stationId} AND is_active = true FOR UPDATE`
    );
    const fresh = await findMatchingAvailabilitySlot(stationId, startTimeIso, durationMin);
    if (!fresh) throw new SlotFullError();

    const [slot] = await tx
      .insert(timeSlotsTable)
      .values({
        station_id: stationId,
        start_time: startTime,
        end_time: endTime,
        capacity: 1,
        booked_count: 1,
        status: 'available',
      })
      .returning();
    if (!slot) throw new Error('Insert time slot failed');

    const oldPosition = entry.queue_position ?? 0;
    await shiftQueuePositions(stationId, oldPosition + 1, -1, tx);
    return updateEntry(
      entryId,
      {
        entry_type: 'reservation',
        post_id: fresh.post_id,
        time_slot_id: slot.id,
        queue_position: null,
        status: STATUS_PENDING_PAYMENT,
        booking_source: 'standard',
        ...mapSplitToEntryFinancialSnapshot(split),
        stripe_payment_id: paymentIntentId,
      },
      tx
    );
  }).catch(async (txError: unknown) => {
    try {
      await cancelPaymentIntent(paymentIntentId);
    } catch (cancelErr) {
      console.error('[UPGRADE_TO_RESERVATION_BY_START_TIME] Failed to cancel orphaned PI after TX failure', {
        paymentIntentId,
        error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
      });
    }
    throw txError;
  });

  try {
    await updatePaymentIntentMetadata(paymentIntentId, { reservation_id: entryId });
  } catch (e) {
    console.error('[UPGRADE_TO_RESERVATION_BY_START_TIME] PI metadata update failed - non-fatal', {
      entryId,
      paymentIntentId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const client = await findById(userId);
  const clientName = client?.first_name ?? 'Un client';
  await notifyEntry({
    entryId,
    userId,
    stationId,
    type: 'reservation_created',
  });
  await notifyClientFeed({
    userId,
    entryId,
    stationId,
    kind: 'reservation_created',
    body: 'Votre réservation a été enregistrée. Complétez le paiement pour confirmer.',
  });
  await notifyStationFeed({
    stationId,
    entryId,
    kind: 'queue_upgraded_to_reservation',
    body: `${clientName} a converti sa place en réservation (${amountTotal.toFixed(2)} $)`,
  });

  return { entry: updated, clientSecret };
}


const VALID_STATION_TRANSITIONS: Record<string, readonly string[]> = {
  pending_payment: ['in_progress', 'cancelled'],
  pending:         ['in_progress', 'cancelled'],
  confirmed:       ['in_progress', 'cancelled'],
  in_progress:     ['completed', 'cancelled'],
};

/**
 * Updates an entry's status (station only). Used by PATCH /station/entries/:entryId.
 * Enforces valid status transitions:
 *   confirmed   → in_progress | cancelled
 *   in_progress → completed   | cancelled
 * Any other transition is rejected with a ConflictError.
 *
 * On status completed:
 *   - Captures the Stripe PaymentIntent (reservation entries only) to distribute funds.
 *   - Invitation_to_rate push is triggered later by Stripe webhook (payment_intent.succeeded)
 *     to align notifications with escrow release and ensure idempotence.
 *   - No per-transaction escrow email is sent here; admin email reporting is weekly (cron).
 * If the Stripe capture fails, the entry is still marked completed and the error is logged
 * for manual resolution (the service was rendered).
 */
export async function setEntryStatusByStation(
  entryId: string,
  stationId: string,
  status: 'in_progress' | 'completed' | 'cancelled'
): Promise<Entry> {
  const entry = await findEntryByIdAndStation(entryId, stationId);
  if (!entry) throw new NotFoundError('Entry not found');

  const allowed = VALID_STATION_TRANSITIONS[entry.status];
  if (!allowed || !allowed.includes(status)) {
    throw new ConflictError(
      `Cannot transition entry from '${entry.status}' to '${status}'`
    );
  }

  // Station-side cancellation: atomically free the slot in the same transaction as the
  // status update so the slot booked_count never lingers above reality (bug #7).
  // The PI release (cancel for pending_payment, refund for confirmed) happens after the
  // commit so we never hold DB locks during Stripe network I/O.
  const updated = await db.transaction(async (tx) => {
    const row = await updateEntry(
      entryId,
      {
        status,
        ...(status === 'completed' ? { completed_at: new Date() } : {}),
      },
      tx
    );
    if (status === 'cancelled' && entry.entry_type === 'reservation' && entry.time_slot_id) {
      await decrementSlotBookedCount(entry.time_slot_id, tx);
    }
    return row;
  });

  if (status === 'cancelled' && entry.stripe_payment_id) {
    // pending_payment → cancel the authorization (no charge ever happened).
    // confirmed → also cancel: funds were authorized but never captured, releasing the hold
    //             is the correct behaviour for a station-initiated cancellation. Compensation
    //             policy (refund vs penalty) lives in the client-driven cancellation path.
    if (entry.status === 'pending_payment' || entry.status === 'confirmed') {
      try {
        await cancelPaymentIntent(entry.stripe_payment_id);
      } catch (e) {
        const err = classifyStripeError(e);
        console.error('[STATION_CANCEL_PI_FAILED]', {
          entryId,
          stripe_payment_id: entry.stripe_payment_id,
          previous_status: entry.status,
          error_class: err.class,
          error_code: err.code,
          error: err.message,
        });
        logFinancialEvent({
          event: 'PI_CANCEL_FAILED',
          stripePaymentIntentId: entry.stripe_payment_id,
          entryId,
          stationId,
          meta: {
            error_class: err.class,
            error_code: err.code ?? null,
            context: 'station_cancel',
            previous_status: entry.status,
          },
        });
        await markPiCancelFailed(entryId).catch(() => undefined);
      }
    }
  }
  if (status === 'completed') {
    // Capture the payment (distributes funds to station + platform).
    if (entry.stripe_payment_id) {
      try {
        const { chargeId, transferId, charged } = await capturePaymentIntent(entry.stripe_payment_id);
        if (charged && chargeId) {
          await updateEntry(entryId, { stripe_charge_id: chargeId });
        }
        if (charged && transferId) {
          // Persist stripe_transfer_id right after capture: this is the most reliable moment
          // to map the destination-charge transfer to the reservation. Without this, the
          // transfer.created webhook is the only fallback and may race against the lookup
          // (bug #4: stripe_transfer_id never persisted → dispute refunds wrongly billed to platform).
          await setStripeTransferIdIfMissing(entryId, transferId).catch((e) => {
            console.error('[CAPTURE_TRANSFER_ID_PERSIST_FAILED]', {
              entryId,
              transferId,
              error: e instanceof Error ? e.message : String(e),
            });
          });
        }
        if (!charged) {
          // PI was already cancelled — funds were never held. Service is complete but
          // no financial distribution occurs. Log for ops visibility.
          console.warn('[CAPTURE_SKIPPED] PI was already canceled at service completion', {
            entryId,
            stripe_payment_id: entry.stripe_payment_id,
          });
        }
      } catch (e) {
        const err = classifyStripeError(e);
        console.error('[CAPTURE_FAILED] Service completed but Stripe capture failed — manual resolution required', {
          entryId,
          stripe_payment_id: entry.stripe_payment_id,
          error_class: err.class,
          error_code: err.code,
          error: err.message,
        });
      }
    }

    // Re-fetch after capture: the Stripe webhook `payment_intent.succeeded` may have written
    // `stripe_payment_succeeded_at` while we were awaiting capturePaymentIntent. Reading from
    // the pre-capture `updated` snapshot would miss it and skip the escrow notification (bug #5).
    const postCapture = (await findEntryById(entryId)) ?? updated;
    if (postCapture.entry_type === 'reservation' && postCapture.stripe_payment_succeeded_at) {
      try {
        const claimed = await setStripePaymentSucceededNotifiedAtIfMissing(
          postCapture.id,
          postCapture.stripe_payment_succeeded_at
        );

        if (claimed) {
          try {
            await sendEscrowReleasedNotificationsForEntry(
              postCapture,
              postCapture.stripe_payment_succeeded_at
            );
          } catch (err) {
            // Isolated try/catch so a clear failure does not mask the original notification error (bug #20).
            try {
              await clearStripePaymentSucceededNotifiedAt(postCapture.id);
            } catch (clearErr) {
              console.error('[ESCROW_FALLBACK] CRITICAL: failed to clear notified_at after notification failure — will not retry', {
                entryId: postCapture.id,
                clearError: clearErr instanceof Error ? clearErr.message : String(clearErr),
              });
            }
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[ESCROW_FALLBACK] Escrow released notifications failed', { error: msg });
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[ESCROW_FALLBACK] Failed to send completed escrow notifications', { error: msg });
      }
    }

    // Refresh station_stats so completed_count stays current for the "most visited" sort group.
    // Fire-and-forget: must not block the station's UI response.
    refreshStationStats().catch((err) => {
      console.error('[STATION_STATS_REFRESH] Failed after reservation completion', {
        entryId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /* Notify the client of service status changes (best-effort, never block the station UI).
   * Unregistered walk-ins (walk_in_client_email set, no matching account) skip
   * in-app notifications since there is no client account to receive them;
   * a receipt email fires on completion instead.
   * Matched walk-ins have walk_in_client_email cleared so hasRealClient = true. */
  const hasRealClient = !entry.walk_in_client_email;
  if (status === 'in_progress' && hasRealClient) {
    notifyEntry({ entryId, userId: entry.user_id, stationId, type: 'service_started' }).catch(() => {});
    notifyClientFeed({ userId: entry.user_id, entryId, stationId, kind: 'service_started', body: 'Votre lavage a commencé. Vous serez notifié quand il sera terminé.' }).catch(() => {});
  } else if (status === 'completed') {
    if (hasRealClient) {
      notifyEntry({ entryId, userId: entry.user_id, stationId, type: 'service_completed' }).catch(() => {});
      notifyClientFeed({ userId: entry.user_id, entryId, stationId, kind: 'service_completed', body: 'Votre lavage est terminé ! Venez récupérer votre véhicule.' }).catch(() => {});
    } else if (updated.walk_in_client_email && !updated.walk_in_receipt_sent_at) {
      /* Read from `updated` (the RETURNING row) to avoid a race where two
       * concurrent "Complete" requests both read walk_in_receipt_sent_at=null
       * from the pre-update snapshot and both fire the email. */
      void sendWalkInReceiptEmailForEntry(updated).catch((err) => {
        console.error('[WALK_IN_RECEIPT] Failed to send completion email', {
          entryId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  return updated;
}

/** Fires the walk-in receipt email and marks the entry as 'sent'. */
async function sendWalkInReceiptEmailForEntry(entry: Entry): Promise<void> {
  if (!entry.walk_in_client_email) return;
  const stationRow = await findStationById(entry.station_id);
  const serviceRow = entry.service_id
    ? await findEnrichedService(entry.service_id)
    : null;
  const vehicleFormatLabel = entry.vehicle_format_id
    ? (await findFormatById(entry.vehicle_format_id))?.label
    : undefined;
  await sendWalkInReceiptEmail({
    to: entry.walk_in_client_email,
    clientName: entry.walk_in_client_name ?? undefined,
    stationName: stationRow?.name,
    serviceName: serviceRow?.name,
    vehicleFormatLabel,
    completedAt: entry.completed_at ?? new Date(),
  });
  await updateEntry(entry.id, { walk_in_receipt_sent_at: new Date() });
}


/**
 * Starts a service for an entry only if the code matches the one issued at booking.
 * Wraps the same transition logic as setEntryStatusByStation('in_progress') but
 * adds a code-equality check (uppercased + whitespace-trimmed on both sides).
 *
 * Throws:
 *  - NotFoundError if the entry is not found or does not belong to the station
 *  - InvalidTicketCodeError (400) if the code is missing or does not match
 *  - ConflictError if the entry status cannot transition to in_progress
 */
export async function startEntryByStation(
  entryId: string,
  stationId: string,
  rawCode: string
): Promise<Entry> {
  const entry = await findEntryByIdAndStation(entryId, stationId);
  if (!entry) throw new NotFoundError('Entry not found');

  /* Walk-in entries (no Stripe PI) skip the code prompt entirely:
   * the off-platform client never received a ticket code so the
   * merchant should be able to start the service without one. The
   * frontend already routes walk-ins to PATCH /station/entries/:id
   * directly, this branch is defence in depth for direct API calls
   * to the legacy /start endpoint. */
  if (!entry.stripe_payment_id) {
    return setEntryStatusByStation(entryId, stationId, 'in_progress');
  }

  // Compare with constant-time-ish equality on uppercased trimmed strings.
  // ticket_code is null on legacy entries (pre-migration) - reject those too.
  const normalizedInput = (rawCode ?? '').replace(/\s+/g, '').toUpperCase();
  const stored = (entry.ticket_code ?? '').toUpperCase();
  if (!stored || normalizedInput.length !== stored.length || normalizedInput !== stored) {
    throw new InvalidTicketCodeError();
  }

  return setEntryStatusByStation(entryId, stationId, 'in_progress');
}


/**
 * Creates a walk-in entry for the station.
 * If time_slot_id is provided, entry_type is 'reservation'; otherwise 'queue'.
 * The format must belong to the station. Status is 'confirmed' (payment collected on-site).
 *
 * Walk-ins have no registered customer account, but `reservations.user_id` is a non-null
 * FK to `users.id`. We therefore record the station owner's user_id as the placeholder,
 * which is a real users row and is already authorized for the station. This keeps the FK
 * valid and prevents the row from being incorrectly attributed to an unrelated user.
 * Filtering walk-ins out of "my entries" listings is done via station.user_id ownership
 * checks where applicable.
 */
export interface CreateWalkInOptions {
  stationId: string;
  stationOwnerUserId: string;
  /** Optional: services without configured formats can still be enqueued. */
  vehicleFormatId?: string;
  timeSlotId?: string;
  serviceId?: string;
  /** Walk-in client identity. If clientEmail matches a registered
   *  client account, the entry is tied to that user (so they see it
   *  in /me/entries and /client/history). Otherwise the email + name
   *  are stored on the entry and the receipt email fires on completion. */
  clientEmail?: string;
  clientName?: string;
}

export async function createWalkInEntry(opts: CreateWalkInOptions): Promise<Entry> {
  const {
    stationId,
    stationOwnerUserId,
    vehicleFormatId,
    timeSlotId,
    serviceId,
    clientEmail,
    clientName,
  } = opts;

  /* Format is now optional: services with no vehicle_format configured
   * still need to support walk-ins. When absent, amount_paid is derived
   * from the picked service's cheapest active entry, or 0 if neither is
   * available (in which case the station collects payment off-platform). */
  const format = vehicleFormatId
    ? (await findFormatById(vehicleFormatId)) ?? null
    : null;
  if (vehicleFormatId && !format) throw new NotFoundError('Vehicle format not found');

  const amount = await resolveWalkInAmount({
    format,
    serviceId: serviceId ?? null,
    stationId,
  });

  /* Try to match the walk-in client to a registered account. Matched
   * clients get the entry attached to their user_id so it shows up in
   * their /me/entries; unmatched clients keep the owner placeholder
   * and carry their identity in walk_in_client_* columns. */
  const matchedUser = clientEmail
    ? await findByEmail(clientEmail)
    : null;
  const isClient =
    matchedUser && matchedUser.role === 'client' && matchedUser.status !== 'deleted';
  const entryUserId = isClient ? matchedUser.id : stationOwnerUserId;
  const walkInEmail = isClient ? null : clientEmail ?? null;
  const walkInName = isClient ? null : clientName ?? null;

  if (timeSlotId) {
    return createReservationEntry({
      user_id: entryUserId,
      station_id: stationId,
      vehicle_format_id: vehicleFormatId ?? null,
      service_id: serviceId,
      time_slot_id: timeSlotId,
      booking_source: 'standard',
      status: STATUS_CONFIRMED,
      amount_paid: toDecimal(String(amount)),
      commission_rate: '0',
      commission_amount: '0',
      station_payout: toDecimal(String(amount)),
      ticket_code: generateTicketCode(),
      walk_in_client_email: walkInEmail,
      walk_in_client_name: walkInName,
    });
  }

  const queuePosition = await getNextQueuePosition(stationId);
  return createQueueEntry({
    user_id: entryUserId,
    station_id: stationId,
    vehicle_format_id: vehicleFormatId ?? null,
    service_id: serviceId,
    queue_position: queuePosition,
    status: STATUS_CONFIRMED,
    amount_paid: toDecimal(String(amount)),
    commission_rate: '0',
    commission_amount: '0',
    station_payout: toDecimal(String(amount)),
    ticket_code: generateTicketCode(),
    walk_in_client_email: walkInEmail,
    walk_in_client_name: walkInName,
  });
}

/** Resolves the price snapshooted on a walk-in: picks the vehicle format
 *  price when one is provided, falls back to the service's cheapest
 *  active vehicle entry, and finally to 0 (off-platform payment). */
async function resolveWalkInAmount(args: {
  format: { price: string | number } | null;
  serviceId: string | null;
  stationId: string;
}): Promise<number | string> {
  if (args.format) return args.format.price;
  if (args.serviceId) {
    /* Enriched fetch so we can read the service's vehicle_entries.
     * findServiceByIdAndStation returns only the bare service row. */
    const ownerService = await findServiceByIdAndStation(args.serviceId, args.stationId);
    if (ownerService) {
      const enriched = await findEnrichedService(args.serviceId);
      if (enriched) {
        const prices = enriched.vehicle_entries
          .filter((e) => e.is_active)
          .map((e) => parseDecimal(String(e.price)))
          .filter((n) => !Number.isNaN(n) && n > 0);
        if (prices.length > 0) return Math.min(...prices);
      }
    }
  }
  return 0;
}


/** Terminal statuses that block priority changes. */
const TERMINAL_STATUSES = ['cancelled', 'completed', 'in_progress'];

/**
 * Repositions a queue entry to a new position (1-based). 'front' maps to position 1.
 * Shifts neighboring entries to preserve a contiguous, gap-free queue.
 * Throws ConflictError if the entry is not an active queue entry.
 */
export async function setPriorityForEntry(
  entryId: string,
  stationId: string,
  position: 'front' | number
): Promise<Entry> {
  const entry = await findEntryByIdAndStation(entryId, stationId);
  if (!entry) throw new NotFoundError('Entry not found');
  if (entry.entry_type !== 'queue') throw new ConflictError('Entry is not a queue entry');
  if (TERMINAL_STATUSES.includes(entry.status)) {
    throw new ConflictError(`Cannot reprioritize an entry with status '${entry.status}'`);
  }
  if (entry.queue_position == null) throw new ConflictError('Entry has no queue position');

  const newPos = position === 'front' ? 1 : Math.max(1, Math.floor(position));
  await repositionQueueEntry(entryId, stationId, entry.queue_position, newPos);

  const updated = await findEntryByIdAndStation(entryId, stationId);
  if (!updated) throw new NotFoundError('Entry not found after update');
  return updated;
}
