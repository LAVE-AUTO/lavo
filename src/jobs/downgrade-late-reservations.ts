/**
 * Cron job: find reservations past late_tolerance (unconfirmed), move each to queue via
 * moveReservationToQueue (uses queue-position helper), then send notifications.
 * Invoked by GET /api/cron/downgrade-late-reservations (with CRON_SECRET header).
 */
import { runWithConcurrencyLimit } from '@/helpers/concurrency';
import { listLateUnconfirmedReservations } from '@/server/reservations/entry-repository';
import { moveReservationToQueue } from '@/server/reservations/queue-service';

export type DowngradeLateReservationsResult = {
  processed: number;
  succeeded: number;
  failed: number;
  errors: Array<{ entryId: string; error: string }>;
};

/**
 * Finds all late unconfirmed reservations, moves each to queue, and returns counts.
 */
const DOWNGRADE_CONCURRENCY = 8;


export async function runDowngradeLateReservations(): Promise<DowngradeLateReservationsResult> {
  const entries = await listLateUnconfirmedReservations();
  const result: DowngradeLateReservationsResult = {
    processed: entries.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };
  const settled = await runWithConcurrencyLimit(entries, DOWNGRADE_CONCURRENCY, async (entry) => {
    await moveReservationToQueue(entry.id);
  });
  settled.forEach((outcome, index) => {
    const entry = entries[index];
    if (!entry) return;
    if (outcome.status === 'fulfilled') {
      result.succeeded += 1;
    } else {
      result.failed += 1;
      const reason = outcome.reason;
      result.errors.push({
        entryId: entry.id,
        error: reason instanceof Error ? reason.message : String(reason),
      });
    }
  });
  return result;
}
