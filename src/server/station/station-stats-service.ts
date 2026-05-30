import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Refreshes the station_stats materialized view concurrently.
 * CONCURRENTLY allows reads to continue during the refresh without locking the view.
 * Requires the unique index station_stats_station_id_idx to be present (created in migration 0035).
 *
 * This function is intended to be called fire-and-forget after operations that affect
 * the view's source data: reservation completions and rating inserts/visibility changes.
 */
export async function refreshStationStats(): Promise<void> {
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY station_stats`);
}
