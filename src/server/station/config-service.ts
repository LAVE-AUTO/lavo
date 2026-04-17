/**
 * Station config business logic. Used by GET/PATCH /api/v1/station/config.
 * Ensures default config is created on first read when station exists.
 */
import {
  getConfigByStationId,
  getPostsByStationId,
  upsertConfig,
  upsertPosts,
  DEFAULT_OPENING_TIME,
  DEFAULT_CLOSING_TIME,
  DEFAULT_WASH_DURATION_MINUTES,
  DEFAULT_LATE_TOLERANCE_MINUTES,
  DEFAULT_CANCELLATION_DELAY_MINUTES,
  DEFAULT_MARGIN_BEFORE_MINUTES,
  DEFAULT_MARGIN_AFTER_MINUTES,
  type StationConfig,
  type StationPost,
} from './config-repository';

export type ConfigWithPosts = {
  config: StationConfig;
  posts: StationPost[];
};

/**
 * Returns the station config and posts. If no config exists, creates a default config
 * (opening 08:00, closing 20:00; wash_post_count and max_concurrent_posts resolved on insert
 * from station via config-repository) and returns it with empty posts. Caller must ensure station exists and is active.
 */
export async function getOrCreateConfig(stationId: string): Promise<ConfigWithPosts> {
  let config = await getConfigByStationId(stationId);
  if (!config) {
    config = await upsertConfig(
      stationId,
      {
        opening_time: DEFAULT_OPENING_TIME,
        closing_time: DEFAULT_CLOSING_TIME,
        break_start: null,
        break_end: null,
        wash_duration_minutes: DEFAULT_WASH_DURATION_MINUTES,
        late_tolerance_minutes: DEFAULT_LATE_TOLERANCE_MINUTES,
        cancellation_delay_minutes: DEFAULT_CANCELLATION_DELAY_MINUTES,
        margin_before_minutes: DEFAULT_MARGIN_BEFORE_MINUTES,
        margin_after_minutes: DEFAULT_MARGIN_AFTER_MINUTES,
      },
      { existing: undefined }
    );
  }
  const posts = await getPostsByStationId(stationId);
  return { config, posts };
}

/**
 * Updates station config and optionally station_posts. posts array: { position, is_active }.
 * Positions are 1-based; upserts by (station_id, position).
 */
export async function updateConfig(
  stationId: string,
  configPayload: Partial<{
    opening_time: string;
    closing_time: string;
    break_start: string | null;
    break_end: string | null;
    wash_duration_minutes: number;
    wash_post_count: number;
    late_tolerance_minutes: number;
    cancellation_delay_minutes: number;
    max_concurrent_posts: number;
    margin_before_minutes: number;
    margin_after_minutes: number;
    /** API may send a number; persisted as Drizzle `decimal` (string) in DB. */
    reservation_surcharge: number | null;
  }>,
  postsPayload?: Array<{ position: number; is_active: boolean }>
): Promise<ConfigWithPosts> {
  const { reservation_surcharge, ...restConfig } = configPayload;
  const dbConfig: Parameters<typeof upsertConfig>[1] = { ...restConfig };
  if (reservation_surcharge !== undefined) {
    dbConfig.reservation_surcharge =
      reservation_surcharge === null ? null : String(reservation_surcharge);
  }
  const config = await upsertConfig(stationId, dbConfig);
  if (postsPayload !== undefined) {
    await upsertPosts(stationId, postsPayload);
  }
  const posts = await getPostsByStationId(stationId);
  return { config, posts };
}
