/**
 * Cron job: detect active queue entries past station closing time and process them as no-shows.
 * Invoked by GET /api/cron/mark-queue-no-shows (with CRON_SECRET header).
 * Should be scheduled to run once per day, after the latest station closing time.
 */
import { markQueueNoShows, type MarkNoShowsResult } from '@/server/reservations/no-show-service';

export type { MarkNoShowsResult };

export async function runMarkQueueNoShows(): Promise<MarkNoShowsResult> {
  return markQueueNoShows();
}
