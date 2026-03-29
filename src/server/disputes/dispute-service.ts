import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { adminLogs, reservations } from '@/lib/db/schema';
import {
  NotFoundError,
  ForbiddenError,
  DisputeAlreadyExistsError,
  DisputeAlreadyClosedError,
  RefundNotEligibleError,
  ValidationError,
} from '@/lib/errors';
import { refundPaymentIntent } from '@/server/payments/payment-service';
import * as repo from './dispute-repository';
import type { CreateDisputeInput, RefundDisputeInput, CloseDisputeInput, ListDisputesQuery } from '@/validators/dispute';

// ─── Client ───────────────────────────────────────────────────────────────────

/** Maximum number of days after reservation completion within which a dispute can be opened. */
const DISPUTE_WINDOW_DAYS = 30;

/**
 * Creates a dispute for a completed, paid reservation.
 * Validates ownership, payment status, time window, and uniqueness before inserting.
 *
 * @throws NotFoundError — reservation not found
 * @throws ForbiddenError — reservation does not belong to the client
 * @throws ValidationError — reservation not completed, not paid, or outside the 30-day window
 * @throws DisputeAlreadyExistsError — a dispute already exists for this reservation
 */
export async function createDispute(
  clientId: string,
  input: CreateDisputeInput
): Promise<repo.Dispute> {
  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, input.reservation_id),
  });
  if (!reservation) throw new NotFoundError('Reservation not found');

  if (reservation.user_id !== clientId) {
    throw new ForbiddenError('This reservation does not belong to you');
  }

  if (reservation.status !== 'completed') {
    throw new ValidationError('Disputes can only be opened for completed reservations');
  }

  if (!reservation.stripe_payment_id || !reservation.stripe_payment_succeeded_at) {
    throw new ValidationError('Reservation has no confirmed payment');
  }

  // Enforce the dispute filing window (30 days from completion).
  // Use stripe_payment_succeeded_at as an intermediate fallback because
  // updated_at reflects any row edit and can be arbitrarily recent or old.
  const completedAt =
    reservation.completed_at ??
    reservation.stripe_payment_succeeded_at ??
    reservation.updated_at;
  const windowMs = DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  if (Date.now() - completedAt.getTime() > windowMs) {
    throw new ValidationError(
      `Disputes must be opened within ${DISPUTE_WINDOW_DAYS} days of reservation completion`
    );
  }

  // SECURITY: requested_amount must not exceed what was actually paid
  if (input.requested_amount !== undefined) {
    const amountPaid = parseFloat(reservation.amount_paid);
    if (Number.isFinite(amountPaid) && input.requested_amount > amountPaid) {
      throw new ValidationError('Requested amount cannot exceed the amount paid for this reservation');
    }
  }

  const existing = await repo.findDisputeByReservationId(input.reservation_id);
  if (existing) throw new DisputeAlreadyExistsError();

  return repo.createDispute({
    reservation_id: input.reservation_id,
    client_id: clientId,
    station_id: reservation.station_id,
    reason: input.reason,
    description: input.description,
    requested_amount:
      input.requested_amount !== undefined ? input.requested_amount.toFixed(2) : undefined,
  });
}

// ─── Admin: list ──────────────────────────────────────────────────────────────

export type DisputeListResult = {
  items: repo.DisputeListItem[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
};

/**
 * Returns a paginated, filtered list of disputes for admin consumption.
 */
export async function listDisputesAdmin(query: ListDisputesQuery): Promise<DisputeListResult> {
  const { status, station_id, client_id, date_from, date_to, page, per_page } = query;

  const { items, total } = await repo.listDisputes(
    {
      status,
      station_id,
      client_id,
      date_from: date_from ? new Date(date_from) : undefined,
      date_to: date_to ? new Date(date_to) : undefined,
    },
    page,
    per_page
  );

  return {
    items,
    meta: {
      total,
      page,
      per_page,
      total_pages: Math.ceil(total / per_page),
    },
  };
}

// ─── Admin: refund ────────────────────────────────────────────────────────────

/**
 * Issues a Stripe refund for a dispute and updates the dispute record.
 * Runs the DB update + admin log in a single transaction to ensure consistency.
 *
 * @throws NotFoundError — dispute not found
 * @throws DisputeAlreadyClosedError — dispute is not open
 * @throws NotFoundError — reservation not found
 * @throws RefundNotEligibleError — stripe_transfer_id exists (transfer already made)
 * @throws ValidationError — refund amount exceeds amount paid
 */
export async function refundDispute(
  adminId: string,
  disputeId: string,
  input: RefundDisputeInput
): Promise<repo.Dispute> {
  const dispute = await repo.findDisputeById(disputeId);
  if (!dispute) throw new NotFoundError('Dispute not found');
  if (dispute.status !== 'open') throw new DisputeAlreadyClosedError();

  const reservation = await db.query.reservations.findFirst({
    where: eq(reservations.id, dispute.reservation_id),
  });
  if (!reservation) throw new NotFoundError('Reservation not found');
  if (!reservation.stripe_payment_id) throw new ValidationError('Reservation has no Stripe payment');

  // Block refund if a transfer to the station has already been made.
  if (reservation.stripe_transfer_id) {
    throw new RefundNotEligibleError();
  }

  const amountPaidCents = Math.round(parseFloat(reservation.amount_paid) * 100);

  let refundAmountCents: number | undefined;
  if (input.amount !== undefined) {
    refundAmountCents = Math.round(input.amount * 100);
    if (refundAmountCents <= 0) throw new ValidationError('Refund amount must be greater than 0');
    if (refundAmountCents > amountPaidCents) {
      throw new ValidationError('Refund amount exceeds the amount paid for this reservation');
    }
  }

  // Call Stripe — outside the transaction to avoid holding a DB lock during network I/O.
  // The idempotency key is scoped to this dispute so retries on network timeout do not
  // issue a second refund.
  const stripeRefundId = await refundPaymentIntent(
    reservation.stripe_payment_id,
    refundAmountCents,
    `refund_dispute_${disputeId}`
  );

  const refundedAmountCents = refundAmountCents ?? amountPaidCents;
  const refundedAmount = (refundedAmountCents / 100).toFixed(2);

  let updatedDispute: repo.Dispute | undefined;

  await db.transaction(async (tx) => {
    updatedDispute = await repo.updateDispute(
      disputeId,
      {
        status: 'refunded',
        refunded_amount: refundedAmount,
        stripe_refund_id: stripeRefundId,
      },
      tx
    );

    await tx.insert(adminLogs).values({
      admin_id: adminId,
      action: 'REFUND_DISPUTE',
      target_type: 'dispute',
      target_id: disputeId,
      details: {
        amount: refundedAmount,
        previous_status: 'open',
        new_status: 'refunded',
        stripe_refund_id: stripeRefundId,
      },
    });
  });

  if (!updatedDispute) throw new NotFoundError('Dispute not found after update');
  return updatedDispute;
}

// ─── Admin: close ─────────────────────────────────────────────────────────────

/**
 * Closes a dispute as resolved or rejected without issuing a refund.
 * Runs the DB update + admin log in a single transaction.
 *
 * @throws NotFoundError — dispute not found
 * @throws DisputeAlreadyClosedError — dispute is not open
 */
export async function closeDispute(
  adminId: string,
  disputeId: string,
  input: CloseDisputeInput
): Promise<repo.Dispute> {
  const dispute = await repo.findDisputeById(disputeId);
  if (!dispute) throw new NotFoundError('Dispute not found');
  if (dispute.status !== 'open') throw new DisputeAlreadyClosedError();

  let updatedDispute: repo.Dispute | undefined;

  await db.transaction(async (tx) => {
    updatedDispute = await repo.updateDispute(
      disputeId,
      {
        status: input.status,
        closed_by: adminId,
        closed_reason: input.reason,
      },
      tx
    );

    await tx.insert(adminLogs).values({
      admin_id: adminId,
      action: 'CLOSE_DISPUTE',
      target_type: 'dispute',
      target_id: disputeId,
      details: {
        previous_status: 'open',
        new_status: input.status,
        reason: input.reason,
      },
    });
  });

  if (!updatedDispute) throw new NotFoundError('Dispute not found after update');
  return updatedDispute;
}
