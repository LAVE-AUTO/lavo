/**
 * Orphan payment cleanup service.
 * Detects queue entries stuck in 'pending_payment' with no stripe_payment_id (server crash
 * between DB insert and Stripe PaymentIntent creation) and cancels them, then compacts
 * the queue positions for the affected station atomically.
 */
import { db } from '@/lib/db';
import { findOrphanedPendingPaymentEntries, updateEntry, shiftQueuePositions } from './entry-repository';


// %%%%% Types %%%%%
// Cleanup result type

export type OrphanCleanupResult = {
  cancelled: number;
};


// %%%%% Cleanup operations %%%%%
// Find and cancel orphaned payment entries

/**
 * Finds all orphaned pending_payment queue entries older than timeoutMinutes,
 * cancels each one, decrements queue positions for subsequent entries in the same
 * station, and returns the total count of cancelled entries.
 *
 * Each entry is processed in its own transaction so a failure on one entry does
 * not roll back the others. The operation is idempotent: already-cancelled entries
 * are not matched by the query, so re-running produces no additional side effects.
 */
export async function cleanupOrphanedPaymentEntries(
  timeoutMinutes: number
): Promise<OrphanCleanupResult> {
  const orphans = await findOrphanedPendingPaymentEntries(timeoutMinutes);
  let cancelled = 0;

  for (const entry of orphans) {
    const { id: entryId, user_id: userId, station_id: stationId, queue_position: position } = entry;

    try {
      await db.transaction(async (tx) => {
        await updateEntry(
          entryId,
          {
            status: 'cancelled',
            cancellation_reason: 'Payment setup timeout',
            updated_at: new Date(),
          },
          tx
        );

        // Shift entries with a higher position down by 1 to close the gap left by cancellation.
        if (position !== null && position > 0) {
          await shiftQueuePositions(stationId, position + 1, -1, tx);
        }
      });

      cancelled += 1;
      console.log('[ORPHAN_CLEANUP] Cancelled orphaned entry', { entryId, userId, stationId });
    } catch (e) {
      console.error('[ORPHAN_CLEANUP] Failed to cancel orphaned entry', {
        entryId,
        userId,
        stationId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { cancelled };
}
