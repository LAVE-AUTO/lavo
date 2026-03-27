import { db } from '@/lib/db';
import { reservationTips, reservations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { AppError } from '@/lib/errors';
import { HTTP_STATUS } from '@/helpers/constants';

export type Tip = typeof reservationTips.$inferSelect;
export type NewTip = typeof reservationTips.$inferInsert;

/**
 * Finds the tip for a given reservation, if any.
 * Used to enforce the one-tip-per-reservation rule before creation.
 */
export async function findTipByReservationId(reservationId: string): Promise<Tip | undefined> {
  return db.query.reservationTips.findFirst({
    where: eq(reservationTips.reservation_id, reservationId),
  });
}

/**
 * Inserts a new tip record.
 * The unique constraint on reservation_id provides a DB-level idempotency guard.
 * Converts Postgres unique violation (23505) to AppError 409 to handle concurrent
 * duplicate requests that both pass the application-level check.
 */
export async function createTip(data: NewTip): Promise<Tip> {
  try {
    const [tip] = await db.insert(reservationTips).values(data).returning();
    return tip;
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err
      ? (err as { code?: string }).code
      : undefined;
    if (code === '23505') {
      throw new AppError(
        'A tip has already been sent for this reservation',
        HTTP_STATUS.CONFLICT
      );
    }
    throw err;
  }
}

/**
 * Updates the tip status and optionally records the Stripe transfer ID.
 * Called by the payment_intent.succeeded webhook handler when the transfer completes.
 * Returns undefined if the tip was not found.
 */
export async function updateTip(
  id: string,
  fields: { status: string; stripe_transfer_id?: string }
): Promise<Tip | undefined> {
  const [tip] = await db
    .update(reservationTips)
    .set({ ...fields, updated_at: new Date() })
    .where(eq(reservationTips.id, id))
    .returning();
  return tip;
}

/**
 * Denormalizes the tip amount back onto the reservation row.
 * Keeps reservations.tip_amount in sync with the dedicated tips table.
 */
export async function setReservationTipAmount(
  reservationId: string,
  amount: string
): Promise<void> {
  await db
    .update(reservations)
    .set({ tip_amount: amount, updated_at: new Date() })
    .where(eq(reservations.id, reservationId));
}
