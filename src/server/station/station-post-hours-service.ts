/**
 * Per-post (wash bay) availability windows, bounded by the station's own hours.
 *
 * A post's window for a day MUST be a subset of the station's open window(s) for
 * that day (station_hours): a post can't open on a day the station is closed, nor
 * outside the station's window, nor during its break. Absence of a row means the
 * post inherits the station's full hours for that day.
 *
 * The merchant edits these on /station/availability; computeAvailability
 * (post-availability-service) reads them so the real booking flow honours them.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stationPostHours, stationPosts } from '@/lib/db/schema';
import { NotFoundError, ValidationError } from '@/lib/errors';
import { getStationHours } from './station-hours-service';

export interface PostHourWindow {
  day_of_week: number;
  is_open: boolean;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}

export interface PostHoursDto {
  post_id: string;
  position: number;
  hours: PostHourWindow[];
}

interface Window { start: number; end: number }

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function toMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  return Number.isNaN(h) || Number.isNaN(mm) ? null : h * 60 + mm;
}

/**
 * Build the open window list (minutes) for an hours row, mirroring the shape
 * handled by post-availability-service: morning + afternoon, or a single
 * continuous window when only the open/close envelope is set.
 */
function buildWindows(row: {
  is_open: boolean;
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}): Window[] {
  if (!row.is_open) return [];
  const ms = toMinutes(row.morning_start);
  const me = toMinutes(row.morning_end);
  const as = toMinutes(row.afternoon_start);
  const ae = toMinutes(row.afternoon_end);
  const windows: Window[] = [];
  if (ms != null && me != null && me > ms) windows.push({ start: ms, end: me });
  if (as != null && ae != null && ae > as) windows.push({ start: as, end: ae });
  if (windows.length === 0 && ms != null && ae != null && ae > ms) windows.push({ start: ms, end: ae });
  return windows;
}

/** True when `inner` is fully contained inside one of the `outer` windows. */
function isWithin(inner: Window, outer: Window[]): boolean {
  return outer.some((w) => inner.start >= w.start && inner.end <= w.end);
}

/**
 * Returns per-post hours for every active post of the station. A post with no
 * stored row inherits the station's hours for each day (so the merchant sees the
 * effective schedule, then narrows it where wanted).
 */
export async function getStationPostHours(stationId: string): Promise<PostHoursDto[]> {
  const [posts, stationHours] = await Promise.all([
    db.query.stationPosts.findMany({
      where: and(eq(stationPosts.station_id, stationId), eq(stationPosts.is_active, true)),
      orderBy: (p, { asc }) => [asc(p.position)],
    }),
    getStationHours(stationId),
  ]);
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);
  const overrides = await db.query.stationPostHours.findMany({
    where: inArray(stationPostHours.station_post_id, postIds),
  });

  const stationByDay = new Map(stationHours.map((h) => [h.day_of_week, h]));
  const overrideByPostDay = new Map<string, (typeof overrides)[number]>();
  for (const o of overrides) overrideByPostDay.set(`${o.station_post_id}:${o.day_of_week}`, o);

  return posts.map((post) => ({
    post_id: post.id,
    position: post.position,
    hours: ALL_DAYS.map((day) => {
      const ov = overrideByPostDay.get(`${post.id}:${day}`);
      if (ov) {
        return {
          day_of_week: day,
          is_open: ov.is_open,
          morning_start: ov.morning_start,
          morning_end: ov.morning_end,
          afternoon_start: ov.afternoon_start,
          afternoon_end: ov.afternoon_end,
        };
      }
      // Inherit the station's hours for this day.
      const sh = stationByDay.get(day);
      return {
        day_of_week: day,
        is_open: sh?.is_open ?? false,
        morning_start: sh?.morning_start ?? null,
        morning_end: sh?.morning_end ?? null,
        afternoon_start: sh?.afternoon_start ?? null,
        afternoon_end: sh?.afternoon_end ?? null,
      };
    }),
  }));
}

/**
 * Upserts the per-day windows for one post, after validating each day is a
 * subset of the station's hours. Throws ValidationError on any out-of-bounds day.
 */
export async function updateStationPostHours(
  stationId: string,
  postId: string,
  days: PostHourWindow[],
): Promise<PostHoursDto> {
  const post = await db.query.stationPosts.findFirst({
    where: and(eq(stationPosts.id, postId), eq(stationPosts.station_id, stationId)),
  });
  if (!post) throw new NotFoundError('Post not found or does not belong to this station');

  const stationHours = await getStationHours(stationId);
  const stationByDay = new Map(stationHours.map((h) => [h.day_of_week, h]));

  for (const d of days) {
    const sh = stationByDay.get(d.day_of_week);
    const stationWindows = sh ? buildWindows(sh) : [];

    if (!d.is_open) continue;

    // The station must be open that day for the post to be open.
    if (stationWindows.length === 0) {
      throw new ValidationError(`Day ${d.day_of_week}: the station is closed, the post cannot be open`);
    }

    const postWindows = buildWindows(d);
    if (postWindows.length === 0) {
      throw new ValidationError(`Day ${d.day_of_week}: invalid post hours`);
    }
    for (const w of postWindows) {
      if (!isWithin(w, stationWindows)) {
        throw new ValidationError(`Day ${d.day_of_week}: the post hours must stay within the station hours`);
      }
    }
  }

  if (days.length > 0) {
    await db
      .insert(stationPostHours)
      .values(days.map((d) => ({
        station_post_id: postId,
        day_of_week: d.day_of_week,
        is_open: d.is_open,
        morning_start: d.morning_start ?? null,
        morning_end: d.morning_end ?? null,
        afternoon_start: d.afternoon_start ?? null,
        afternoon_end: d.afternoon_end ?? null,
        updated_at: new Date(),
      })))
      .onConflictDoUpdate({
        target: [stationPostHours.station_post_id, stationPostHours.day_of_week],
        set: {
          is_open: sqlExcluded('is_open'),
          morning_start: sqlExcluded('morning_start'),
          morning_end: sqlExcluded('morning_end'),
          afternoon_start: sqlExcluded('afternoon_start'),
          afternoon_end: sqlExcluded('afternoon_end'),
          updated_at: new Date(),
        },
      });
  }

  const all = await getStationPostHours(stationId);
  const dto = all.find((p) => p.post_id === postId);
  if (!dto) throw new NotFoundError('Post not found');
  return dto;
}

/* Drizzle helper: reference the INSERT's excluded.<col> in an upsert SET. */
function sqlExcluded(col: string) {
  return sql.raw(`excluded.${col}`);
}
