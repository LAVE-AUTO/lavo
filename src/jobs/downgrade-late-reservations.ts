/**
 * Cron job: find reservations past late_tolerance (unconfirmed), move each to queue via
 * moveReservationToQueue (uses queue-position helper), then send notifications.
 * Invoked by GET /api/cron/downgrade-late-reservations (with CRON_SECRET header).
 */
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
export async function runDowngradeLateReservations(): Promise<DowngradeLateReservationsResult> {
  const entries = await listLateUnconfirmedReservations();
  const result: DowngradeLateReservationsResult = {
    processed: entries.length,
    succeeded: 0,
    failed: 0,
    errors: [],
  };
  for (const entry of entries) {
    try {
      await moveReservationToQueue(entry.id);
      result.succeeded += 1;
    } catch (e) {
      result.failed += 1;
      result.errors.push({
        entryId: entry.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return result;
}
