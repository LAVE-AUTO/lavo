/**
 * Orphan payment cleanup service.
 * Detects queue entries stuck in 'pending_payment' with no stripe_payment_id (server crash
 * between DB insert and Stripe PaymentIntent creation) and cancels them, then compacts
 * the queue positions for the affected station atomically.
 */
import { db } from '@/lib/db';
import {
  findOrphanedPendingPaymentEntries,
  cancelOrphanedEntryIfEligible,
  shiftQueuePositions,
} from './entry-repository';
import { runWithConcurrencyLimit } from '@/helpers/concurrency';


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

  const results = await runWithConcurrencyLimit(orphans, 8, async (entry) => {
    const { id: entryId, user_id: userId, station_id: stationId, queue_position: position } = entry;

    let wasActuallyCancelled = false;

    await db.transaction(async (tx) => {
      // Guard: only cancel if the entry is still pending_payment with no stripe_payment_id.
      // This prevents overwriting an entry that was confirmed by a late-arriving Stripe webhook
      // between the initial fetch and this transaction.
      const cancelled_row = await cancelOrphanedEntryIfEligible(entryId, tx);
      if (!cancelled_row) {
        // Entry was already handled (confirmed or cancelled by another process). Skip.
        return;
      }

      wasActuallyCancelled = true;

      // Shift entries with a higher position down by 1 to close the gap left by cancellation.
      if (position !== null && position > 0) {
        await shiftQueuePositions(stationId, position + 1, -1, tx);
      }
    });

    if (wasActuallyCancelled) {
      console.log('[ORPHAN_CLEANUP] Cancelled orphaned entry', { entryId, userId, stationId });
    } else {
      console.log('[ORPHAN_CLEANUP] Skipped entry (already handled)', { entryId, userId, stationId });
    }

    return wasActuallyCancelled;
  });

  // Count only entries that were actually cancelled. Reading from the settled results
  // avoids a shared-mutable-variable race between concurrent closure executions.
  const cancelled = results.filter(
    (r): r is PromiseFulfilledResult<boolean> => r.status === 'fulfilled' && r.value === true
  ).length;

  return { cancelled };
}
