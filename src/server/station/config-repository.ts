/**
 * Data access layer for station configuration.
 *
 * Manages two tables:
 *   - station_configs: opening times, washing setup, margins, tolerance, surcharge
 *   - station_posts: numbered wash station positions with active status
 *
 * Used by config-service for GET/PATCH station config API endpoints.
 */
import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stationConfigs, stationPosts, stations } from '@/lib/db/schema';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';


// %%%%% Types %%%%%
// Inferred types from Drizzle schema

export type StationConfig = typeof stationConfigs.$inferSelect;
export type StationConfigInsert = typeof stationConfigs.$inferInsert;
export type StationPost = typeof stationPosts.$inferSelect;
export type StationPostInsert = typeof stationPosts.$inferInsert;


// %%%%% Constants %%%%%
// Default configuration values

export const DEFAULT_OPENING_TIME = '08:00:00+00';
export const DEFAULT_CLOSING_TIME = '20:00:00+00';
export const DEFAULT_WASH_DURATION_MINUTES = 30;
export const DEFAULT_LATE_TOLERANCE_MINUTES = 5;
export const DEFAULT_CANCELLATION_DELAY_MINUTES = 60;
export const DEFAULT_MARGIN_BEFORE_MINUTES = 5;
export const DEFAULT_MARGIN_AFTER_MINUTES = 10;


// %%%%% Config reads %%%%%
// Fetch configuration by station

/**
 * Retrieves the station config row for the given station.
 *
 * Note: `station_configs.id` is the primary key and also the foreign key to `stations.id`.
 * The relationship is 1:1; there is no separate `station_id` column.
 *
 * @param stationId - Station UUID
 * @returns StationConfig row, or undefined if no config exists for this station
 */
export async function getConfigByStationId(stationId: string): Promise<StationConfig | undefined> {
  const row = await db.query.stationConfigs.findFirst({
    where: eq(stationConfigs.id, stationId),
  });
  return row;
}

/**
 * Retrieves all wash station posts for a station, ordered by position.
 *
 * @param stationId - Station UUID
 * @returns Array of StationPost rows, sorted by position (ascending)
 */
export async function getPostsByStationId(stationId: string): Promise<StationPost[]> {
  return db.query.stationPosts.findMany({
    where: eq(stationPosts.station_id, stationId),
    orderBy: (posts, { asc }) => [asc(posts.position)],
  });
}


// %%%%% Config writes %%%%%
// Upsert configuration with defaults and platform setting fallbacks

/**
 * Upserts station config (insert if missing, update if present).
 *
 * Defaults:
 *   - opening_time: 08:00
 *   - closing_time: 20:00
 *   - margins: 5 min before, 10 min after
 *   - late_tolerance: from platform setting or 5 min fallback
 *   - cancellation_delay: 60 min
 *   - wash_post_count / max_concurrent_posts: from station or queried on first insert
 *
 * On insert, if both wash_post_count and max_concurrent_posts are absent,
 * queries the station's wash_post_count once to use as default.
 * Pass `options.existing` to skip the initial lookup (e.g., after a recent read).
 *
 * @param stationId - Station UUID
 * @param data - Partial config data to upsert (id and updated_at are set automatically)
 * @param options - Optional optimization: pass existing config to skip DB lookup
 * @returns Updated or inserted StationConfig row
 */
export async function upsertConfig(
  stationId: string,
  data: Partial<Omit<StationConfigInsert, 'id' | 'updated_at'>>,
  options?: { existing: StationConfig | undefined }
): Promise<StationConfig> {
  const existing =
    options !== undefined ? options.existing : await getConfigByStationId(stationId);
  const now = new Date();
  const platformLateTolerance = parseInt(
    await getPlatformSettingWithFallback(
      'default_late_tolerance_minutes',
      'PLATFORM_DEFAULT_LATE_TOLERANCE_MINUTES',
      String(DEFAULT_LATE_TOLERANCE_MINUTES)
    ),
    10
  );
  const resolvedLateTolerance =
    Number.isFinite(platformLateTolerance) && platformLateTolerance >= 0
      ? platformLateTolerance
      : DEFAULT_LATE_TOLERANCE_MINUTES;
  if (existing) {
    const [updated] = await db
      .update(stationConfigs)
      .set({ ...data, updated_at: now })
      .where(eq(stationConfigs.id, stationId))
      .returning();
    return updated;
  }
  const needsWashDefault =
    data.wash_post_count === undefined || data.max_concurrent_posts === undefined;
  const washDefault = needsWashDefault
    ? (data.wash_post_count ??
        data.max_concurrent_posts ??
        (await getStationWashPostCount(stationId)))
    : (data.wash_post_count as number);
  const insertValues: StationConfigInsert = {
    id: stationId,
    opening_time: data.opening_time ?? DEFAULT_OPENING_TIME,
    closing_time: data.closing_time ?? DEFAULT_CLOSING_TIME,
    break_start: data.break_start ?? null,
    break_end: data.break_end ?? null,
    wash_duration_minutes: data.wash_duration_minutes ?? DEFAULT_WASH_DURATION_MINUTES,
    wash_post_count: data.wash_post_count ?? washDefault,
    late_tolerance_minutes: data.late_tolerance_minutes ?? resolvedLateTolerance,
    cancellation_delay_minutes: data.cancellation_delay_minutes ?? DEFAULT_CANCELLATION_DELAY_MINUTES,
    max_concurrent_posts: data.max_concurrent_posts ?? washDefault,
    margin_before_minutes: data.margin_before_minutes ?? DEFAULT_MARGIN_BEFORE_MINUTES,
    margin_after_minutes: data.margin_after_minutes ?? DEFAULT_MARGIN_AFTER_MINUTES,
    reservation_surcharge: data.reservation_surcharge,
    updated_at: now,
  };
  const [inserted] = await db.insert(stationConfigs).values(insertValues).returning();
  return inserted;
}


/**
 * Upserts station wash posts by (station_id, position).
 *
 * Replaces the entire set of posts for the station with the given list.
 * Positions are 1-based (position 1, 2, 3, etc.).
 *
 * Strategy:
 *   1. Fetch existing posts by station
 *   2. For each post in the new list:
 *      - If position exists, queue update of is_active
 *      - If position missing, queue insert
 *   3. Delete positions no longer in the new list
 *   4. Apply insert, update, delete in separate batches
 *   5. Return full updated post list
 *
 * @param stationId - Station UUID
 * @param posts - List of { position, is_active } items (1-based positions)
 * @returns Updated full list of posts for the station (sorted by position)
 */
export async function upsertPosts(
  stationId: string,
  posts: Array<{ position: number; is_active: boolean }>
): Promise<StationPost[]> {
  const now = new Date();
  const existing = await getPostsByStationId(stationId);
  const existingByPos = new Map(existing.map((p) => [p.position, p]));

  const toInsert: StationPostInsert[] = [];
  const toUpdate: { id: string; is_active: boolean }[] = [];

  for (const { position, is_active } of posts) {
    const row = existingByPos.get(position);
    if (row) {
      toUpdate.push({ id: row.id, is_active });
    } else {
      toInsert.push({
        station_id: stationId,
        position,
        is_active,
        created_at: now,
        updated_at: now,
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(stationPosts).values(toInsert);
  }
  if (toUpdate.length > 0) {
    const whenBranches = sql.join(
      toUpdate.map(
        ({ id, is_active }) =>
          sql`WHEN ${stationPosts.id} = ${id} THEN ${is_active}`
      ),
      sql` `
    );
    await db
      .update(stationPosts)
      .set({
        is_active: sql`CASE ${whenBranches} ELSE ${stationPosts.is_active} END`,
        updated_at: now,
      })
      .where(
        inArray(
          stationPosts.id,
          toUpdate.map((u) => u.id)
        )
      );
  }

  const toDelete = existing.filter((p) => !posts.some((q) => q.position === p.position));
  if (toDelete.length > 0) {
    await db.delete(stationPosts).where(inArray(stationPosts.id, toDelete.map((p) => p.id)));
  }

  return getPostsByStationId(stationId);
}


/**
 * Retrieves the wash post count from the station row.
 * Used when creating default config and wash_post_count is not explicitly provided.
 *
 * @param stationId - Station UUID
 * @returns Wash post count, or 1 if not set or invalid
 */
export async function getStationWashPostCount(stationId: string): Promise<number> {
  const row = await db.query.stations.findFirst({
    where: eq(stations.id, stationId),
    columns: { wash_post_count: true },
  });
  const n = row?.wash_post_count ?? null;
  return typeof n === 'number' && n >= 1 ? n : 1;
}
