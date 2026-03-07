/**
 * Data access for station_configs and station_posts.
 * Used by config-service for GET/PATCH station config API.
 */
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stationConfigs, stationPosts, stations } from '@/lib/db/schema';

export type StationConfig = typeof stationConfigs.$inferSelect;
export type StationConfigInsert = typeof stationConfigs.$inferInsert;
export type StationPost = typeof stationPosts.$inferSelect;
export type StationPostInsert = typeof stationPosts.$inferInsert;

/** Default time strings for config (opening 08:00, closing 20:00). */
export const DEFAULT_OPENING_TIME = '08:00:00+00';
export const DEFAULT_CLOSING_TIME = '20:00:00+00';
export const DEFAULT_WASH_DURATION_MINUTES = 30;
export const DEFAULT_LATE_TOLERANCE_MINUTES = 5;
export const DEFAULT_CANCELLATION_DELAY_MINUTES = 60;
export const DEFAULT_MARGIN_BEFORE_MINUTES = 5;
export const DEFAULT_MARGIN_AFTER_MINUTES = 10;

/**
 * Returns the station config row for the given station id, or undefined.
 */
export async function getConfigByStationId(stationId: string): Promise<StationConfig | undefined> {
  const row = await db.query.stationConfigs.findFirst({
    where: eq(stationConfigs.id, stationId),
  });
  return row;
}

/**
 * Returns all station_posts for the given station, ordered by position.
 */
export async function getPostsByStationId(stationId: string): Promise<StationPost[]> {
  return db.query.stationPosts.findMany({
    where: eq(stationPosts.station_id, stationId),
    orderBy: (posts, { asc }) => [asc(posts.position)],
  });
}

/**
 * Upserts station config. Insert if missing; update if present.
 * Defaults: opening 08:00, closing 20:00, margins 5/10, late_tolerance 5, cancellation_delay from spec (60).
 */
export async function upsertConfig(
  stationId: string,
  data: Partial<Omit<StationConfigInsert, 'id' | 'updated_at'>>
): Promise<StationConfig> {
  const existing = await getConfigByStationId(stationId);
  const now = new Date();
  if (existing) {
    const [updated] = await db
      .update(stationConfigs)
      .set({ ...data, updated_at: now })
      .where(eq(stationConfigs.id, stationId))
      .returning();
    return updated;
  }
  const [inserted] = await db
    .insert(stationConfigs)
    .values({
      id: stationId,
      ...data,
      updated_at: now,
    })
    .returning();
  return inserted;
}

/**
 * Upserts station_posts by (station_id, position). Replaces existing posts for the station
 * with the given list; positions are 1-based. Each item: { position, is_active }.
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
  for (const { id, is_active } of toUpdate) {
    await db
      .update(stationPosts)
      .set({ is_active, updated_at: now })
      .where(eq(stationPosts.id, id));
  }

  const toDelete = existing.filter((p) => !posts.some((q) => q.position === p.position));
  if (toDelete.length > 0) {
    await db.delete(stationPosts).where(inArray(stationPosts.id, toDelete.map((p) => p.id)));
  }

  return getPostsByStationId(stationId);
}

/**
 * Returns wash_post_count for the station (from stations table). Used when creating default config.
 */
export async function getStationWashPostCount(stationId: string): Promise<number> {
  const row = await db.query.stations.findFirst({
    where: eq(stations.id, stationId),
    columns: { wash_post_count: true },
  });
  const n = row?.wash_post_count ?? null;
  return typeof n === 'number' && n >= 1 ? n : 1;
}
