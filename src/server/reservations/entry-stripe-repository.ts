/**
 * Stripe webhook idempotency updates on reservation rows.
 * Kept separate from entry-repository to isolate payment-side effects.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db, type DbTransaction } from '@/lib/db';
import { reservations } from '@/lib/db/schema';

/**
 * Maps a Stripe transfer to a reservation idempotently.
 * Returns true only when stripe_transfer_id was previously NULL and is now set.
 */
export async function setStripeTransferIdIfMissing(
  entryId: string,
  stripeTransferId: string,
  tx?: DbTransaction
): Promise<boolean> {
  const client = tx ?? db;
  const [row] = await client
    .update(reservations)
    .set({
      stripe_transfer_id: stripeTransferId,
      updated_at: new Date(),
    })
    .where(and(eq(reservations.id, entryId), sql`${reservations.stripe_transfer_id} is null`))
    .returning({ id: reservations.id });

  return Boolean(row);
}

/**
 * Marks Stripe PaymentIntent succeeded timestamp idempotently.
 * Returns true only when stripe_payment_succeeded_at was previously NULL.
 */
export async function setStripePaymentSucceededAtIfMissing(
  entryId: string,
  succeededAt: Date,
  tx?: DbTransaction
): Promise<boolean> {
  const client = tx ?? db;
  const [row] = await client
    .update(reservations)
    .set({
      stripe_payment_succeeded_at: succeededAt,
      updated_at: new Date(),
    })
    .where(and(eq(reservations.id, entryId), sql`${reservations.stripe_payment_succeeded_at} is null`))
    .returning({ id: reservations.id });

  return Boolean(row);
}

/**
 * Marks that succeeded notifications (push) are sent idempotently.
 * Returns true only when stripe_payment_succeeded_notified_at was previously NULL.
 */
export async function setStripePaymentSucceededNotifiedAtIfMissing(
  entryId: string,
  notifiedAt: Date,
  tx?: DbTransaction
): Promise<boolean> {
  const client = tx ?? db;
  const [row] = await client
    .update(reservations)
    .set({
      stripe_payment_succeeded_notified_at: notifiedAt,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(reservations.id, entryId),
        sql`${reservations.stripe_payment_succeeded_notified_at} is null`
      )
    )
    .returning({ id: reservations.id });

  return Boolean(row);
}

/**
 * Clears `stripe_payment_succeeded_notified_at` so a later Stripe webhook retry (or fallback)
 * can reclaim and re-run notification side effects after a failed delivery post-claim.
 */
export async function clearStripePaymentSucceededNotifiedAt(
  entryId: string,
  tx?: DbTransaction
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(reservations)
    .set({
      stripe_payment_succeeded_notified_at: null,
      updated_at: new Date(),
    })
    .where(eq(reservations.id, entryId));
}

/**
 * Marks a reservation as needing PI-cancel reconciliation (bug #12). The reconciliation cron
 * scans `pi_cancel_failed_at IS NOT NULL` entries and retries Stripe.paymentIntents.cancel.
 */
export async function markPiCancelFailed(
  entryId: string,
  tx?: DbTransaction
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(reservations)
    .set({ pi_cancel_failed_at: new Date(), updated_at: new Date() })
    .where(eq(reservations.id, entryId));
}

/** Clears the PI-cancel failure marker after a successful reconciliation. */
export async function clearPiCancelFailed(
  entryId: string,
  tx?: DbTransaction
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(reservations)
    .set({ pi_cancel_failed_at: null, updated_at: new Date() })
    .where(eq(reservations.id, entryId));
}

/**
 * Marks a reservation whose Stripe refund succeeded but whose `stripe_refund_id` failed to
 * persist (bug #26). The reconciliation cron looks up the refund on Stripe and writes the id.
 */
export async function markRefundPersistFailed(
  entryId: string,
  tx?: DbTransaction
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(reservations)
    .set({ refund_persist_failed_at: new Date(), updated_at: new Date() })
    .where(eq(reservations.id, entryId));
}

/** Clears the refund-persist failure marker after a successful reconciliation. */
export async function clearRefundPersistFailed(
  entryId: string,
  tx?: DbTransaction
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(reservations)
    .set({ refund_persist_failed_at: null, updated_at: new Date() })
    .where(eq(reservations.id, entryId));
}
