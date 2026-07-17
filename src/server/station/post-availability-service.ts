/**
 * Per-post availability computation for the new on-the-fly reservation flow.
 *
 * Given a station, a date, and a service duration, returns the list of
 * (start_time, end_time, post_id) chunks that:
 *   - fall inside the station's opening windows for that day_of_week
 *     (morning + afternoon segments from `station_hours`),
 *   - leave room for the service to finish before the closing edge,
 *   - do NOT overlap any existing reservation on the same post (with the
 *     configured margin_before / margin_after applied around each booking),
 *   - skip dates flagged as one-off exceptions in `station_hour_exceptions`.
 *
 * The algorithm is per-post: each active wash bay is evaluated independently,
 * its occupied intervals are subtracted, then the remaining free intervals
 * are chunked by the service duration.
 *
 * Distinct from `availability-service.ts` (legacy capacity-based time_slots
 * availability for the merchant calendar).
 */
import { and, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  reservations,
  stationConfigs,
  stationHourExceptions,
  stationHours,
  stationPostHours,
  stationPosts,
  timeSlots,
} from '@/lib/db/schema';
import { NotFoundError } from '@/lib/errors';
import {
  stationDateKey,
  stationNowMinutes,
  stationTodayKey,
  stationWallTimeToUtc,
  utcToStationMinutes,
} from '@/helpers/station-time';

export interface AvailabilitySlot {
  /** ISO 8601 datetime, with the station-local UTC offset preserved. */
  start_time: string;
  /** ISO 8601 datetime; equals start_time + duration_min. */
  end_time: string;
  /** Internal — which wash bay would handle this slot. Hidden in the public response. */
  post_id: string;
}

interface OccupiedInterval {
  startMin: number;
  endMin: number;
}

interface OpenWindow {
  startMin: number;
  endMin: number;
}

/** "HH:MM" or "HH:MM:SS" → minutes since midnight; null on parse failure. */
function timeStringToMinutes(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

/** Subtract `occupied` from `windows`, return remaining free intervals. */
function subtractIntervals(windows: OpenWindow[], occupied: OccupiedInterval[]): OpenWindow[] {
  if (occupied.length === 0) return windows;
  const sortedOccupied = [...occupied].sort((a, b) => a.startMin - b.startMin);

  const free: OpenWindow[] = [];
  for (const win of windows) {
    let cursor = win.startMin;
    for (const occ of sortedOccupied) {
      if (occ.endMin <= cursor || occ.startMin >= win.endMin) continue;
      if (occ.startMin > cursor) {
        free.push({ startMin: cursor, endMin: Math.min(occ.startMin, win.endMin) });
      }
      cursor = Math.max(cursor, occ.endMin);
      if (cursor >= win.endMin) break;
    }
    if (cursor < win.endMin) free.push({ startMin: cursor, endMin: win.endMin });
  }
  return free;
}

/** Intersection of two window lists (used to clamp a post's window to the station's). */
function intersectWindows(a: OpenWindow[], b: OpenWindow[]): OpenWindow[] {
  const out: OpenWindow[] = [];
  for (const x of a) {
    for (const y of b) {
      const start = Math.max(x.startMin, y.startMin);
      const end = Math.min(x.endMin, y.endMin);
      if (end > start) out.push({ startMin: start, endMin: end });
    }
  }
  return out;
}

/** Build window list from a per-post hours row (morning + afternoon segments). */
function postRowWindows(row: {
  morning_start: string | null;
  morning_end: string | null;
  afternoon_start: string | null;
  afternoon_end: string | null;
}): OpenWindow[] {
  const ms = timeStringToMinutes(row.morning_start);
  const me = timeStringToMinutes(row.morning_end);
  const as_ = timeStringToMinutes(row.afternoon_start);
  const ae = timeStringToMinutes(row.afternoon_end);
  const w: OpenWindow[] = [];
  if (ms != null && me != null && me > ms) w.push({ startMin: ms, endMin: me });
  if (as_ != null && ae != null && ae > as_) w.push({ startMin: as_, endMin: ae });
  if (w.length === 0 && ms != null && ae != null && ae > ms) w.push({ startMin: ms, endMin: ae });
  return w;
}

/** Chunk a free interval into D-minute slots starting at `interval.startMin`. */
function chunkInterval(interval: OpenWindow, durationMin: number): OpenWindow[] {
  const out: OpenWindow[] = [];
  let t = interval.startMin;
  while (t + durationMin <= interval.endMin) {
    out.push({ startMin: t, endMin: t + durationMin });
    t += durationMin;
  }
  return out;
}

export interface ComputeAvailabilityArgs {
  stationId: string;
  /** YYYY-MM-DD. Interpreted in the station's local timezone (server clock). */
  date: string;
  /** Service duration in minutes (at least 1). */
  durationMin: number;
}

export type AvailabilityClosedReason = 'day_closed' | 'exception' | 'no_active_post';

export interface ComputeAvailabilityResult {
  date: string;
  slots: AvailabilitySlot[];
  closed_reason?: AvailabilityClosedReason;
}

/**
 * Computes free chunks per post for the requested service duration.
 * Returns `slots = []` and `closed_reason` when the day is fully closed.
 */
export async function computeAvailability(args: ComputeAvailabilityArgs): Promise<ComputeAvailabilityResult> {
  const duration = Math.max(1, Math.floor(args.durationMin));
  const dateKey = args.date;

  const [yearPart, monthPart, dayPart] = dateKey.split('-').map(Number);
  if (!yearPart || !monthPart || !dayPart) {
    return { date: dateKey, slots: [] };
  }
  /* Day-of-week of the calendar date itself (timezone-independent). */
  const dayOfWeek = new Date(Date.UTC(yearPart, monthPart - 1, dayPart)).getUTCDay();
  /* Station-local day bounds as real UTC instants. All wall-clock minutes in
   * this function are expressed in the station timezone (America/Toronto);
   * emitting instants through stationWallTimeToUtc keeps the ISO payload
   * correct no matter which timezone the server process runs in. */
  const startOfDay = stationWallTimeToUtc(dateKey, 0);
  const endOfDay = stationWallTimeToUtc(dateKey, 24 * 60);
  if (Number.isNaN(startOfDay.getTime())) {
    return { date: dateKey, slots: [] };
  }

  const [hourRow, exceptionRow, postsRows, configRow] = await Promise.all([
    db.query.stationHours.findFirst({
      where: and(eq(stationHours.station_id, args.stationId), eq(stationHours.day_of_week, dayOfWeek)),
    }),
    db.query.stationHourExceptions.findFirst({
      where: and(
        eq(stationHourExceptions.station_id, args.stationId),
        eq(stationHourExceptions.exception_date, dateKey)
      ),
    }),
    db.query.stationPosts.findMany({
      where: and(eq(stationPosts.station_id, args.stationId), eq(stationPosts.is_active, true)),
      orderBy: (p, { asc }) => [asc(p.position)],
    }),
    db.query.stationConfigs.findFirst({ where: eq(stationConfigs.id, args.stationId) }),
  ]);

  /* An exception can close the day OR open it (all day, or with special hours).
   * - closed          → is_open false: the station is shut, ignore normal hours.
   * - open with hours  → open_time/close_time set: a single window overriding
   *                      the regular weekday hours.
   * - open all day     → is_open true, no times: force the day open using the
   *                      regular weekday / config windows even if normally closed. */
  let exceptionWindow: OpenWindow | null = null;
  if (exceptionRow) {
    if (!exceptionRow.is_open) {
      return { date: dateKey, slots: [], closed_reason: 'exception' };
    }
    if (exceptionRow.open_time && exceptionRow.close_time) {
      const es = timeStringToMinutes(exceptionRow.open_time);
      const ee = timeStringToMinutes(exceptionRow.close_time);
      if (es != null && ee != null && ee > es) exceptionWindow = { startMin: es, endMin: ee };
    }
  }
  // Non-custom open exception → force the day open using the regular windows.
  const forcedOpenAllDay = exceptionRow != null && exceptionRow.is_open && exceptionWindow == null;

  if (postsRows.length === 0) {
    return { date: dateKey, slots: [], closed_reason: 'no_active_post' };
  }

  /* Build the day's open windows. Priority: exception custom window → per-day
   * station_hours row → global station_configs envelope. Per-post occupancy
   * (from active reservations) is subtracted below. */
  const windows: OpenWindow[] = [];

  if (exceptionWindow) {
    windows.push(exceptionWindow);
  } else {
    if (hourRow) {
      if (!hourRow.is_open && !forcedOpenAllDay) {
        return { date: dateKey, slots: [], closed_reason: 'day_closed' };
      }
      /* A day normally marked closed has no guarantee its morning/afternoon
       * columns are null (nothing clears them on close), so an open-all-day
       * exception must not trust them — fall through to the config envelope. */
      if (hourRow.is_open) {
        const ms = timeStringToMinutes(hourRow.morning_start);
        const me = timeStringToMinutes(hourRow.morning_end);
        const as_ = timeStringToMinutes(hourRow.afternoon_start);
        const ae = timeStringToMinutes(hourRow.afternoon_end);

        if (ms != null && me != null && me > ms) windows.push({ startMin: ms, endMin: me });
        if (as_ != null && ae != null && ae > as_) windows.push({ startMin: as_, endMin: ae });

        /* No regular morning/afternoon pair matched, but we still have a global
         * open/close envelope (morning_start + afternoon_end). Treat the day as
         * a single continuous window. */
        if (windows.length === 0 && ms != null && ae != null && ae > ms) {
          windows.push({ startMin: ms, endMin: ae });
        }
      }
    }

    /* Fall back to the station_configs envelope when there is no usable
     * station_hours window (no per-day row, or an open-all-day exception on a
     * day whose hours row yielded nothing). */
    if (windows.length === 0 && configRow && (!hourRow || forcedOpenAllDay)) {
      const open = timeStringToMinutes(String(configRow.opening_time));
      const close = timeStringToMinutes(String(configRow.closing_time));
      if (open != null && close != null && close > open) {
        const breakStart = timeStringToMinutes(configRow.break_start ? String(configRow.break_start) : null);
        const breakEnd = timeStringToMinutes(configRow.break_end ? String(configRow.break_end) : null);
        if (breakStart != null && breakEnd != null && breakEnd > breakStart && breakStart > open && breakEnd < close) {
          windows.push({ startMin: open, endMin: breakStart });
          windows.push({ startMin: breakEnd, endMin: close });
        } else {
          windows.push({ startMin: open, endMin: close });
        }
      }
    }
  }
  if (windows.length === 0) {
    return { date: dateKey, slots: [], closed_reason: 'day_closed' };
  }

  const marginBefore = configRow?.margin_before_minutes ?? 0;
  const marginAfter = configRow?.margin_after_minutes ?? 0;

  /* Existing reservations on this day (any post). Cancelled / completed
   * statuses are excluded — those bays are free again. */
  const occupiedRows = await db
    .select({
      post_id: reservations.post_id,
      start_time: timeSlots.start_time,
      end_time: timeSlots.end_time,
    })
    .from(reservations)
    .innerJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .where(
      and(
        eq(reservations.station_id, args.stationId),
        eq(reservations.entry_type, 'reservation'),
        isNotNull(reservations.post_id),
        gte(timeSlots.start_time, startOfDay),
        lt(timeSlots.start_time, endOfDay),
        inArray(reservations.status, ['pending_payment', 'confirmed', 'late', 'in_progress'])
      )
    );

  const occupiedByPost = new Map<string, OccupiedInterval[]>();
  for (const row of occupiedRows) {
    if (!row.post_id) continue;
    /* Reservation instants → station-local wall minutes, so subtraction happens
     * in the same coordinate system as the opening windows. */
    const startMin = utcToStationMinutes(row.start_time) - marginBefore;
    const endMin = utcToStationMinutes(row.end_time) + marginAfter;
    const list = occupiedByPost.get(row.post_id) ?? [];
    list.push({ startMin, endMin });
    occupiedByPost.set(row.post_id, list);
  }

  /* Block past-time chunks today.
   * Station hours are stored as naive local times (America/Toronto); use the
   * same timezone for "now" so the cutoff aligns with the station's coordinate
   * system (avoids a UTC-vs-local offset on Vercel's UTC servers). */
  const isToday = dateKey === stationTodayKey();
  const nowMin = isToday ? stationNowMinutes() : -Infinity;

  /* Per-post hours overrides for this day of week. When a post has a row it can
   * only narrow availability within the station window (validated on save); no
   * row means the post inherits the full station window. */
  const postHourRows = await db.query.stationPostHours.findMany({
    where: and(
      inArray(stationPostHours.station_post_id, postsRows.map((p) => p.id)),
      eq(stationPostHours.day_of_week, dayOfWeek),
    ),
  });
  const postHourByPost = new Map(postHourRows.map((r) => [r.station_post_id, r]));

  const slots: AvailabilitySlot[] = [];
  for (const post of postsRows) {
    const override = postHourByPost.get(post.id);
    let postWindows = windows;
    if (override) {
      if (!override.is_open) continue; // post explicitly closed this day
      postWindows = intersectWindows(windows, postRowWindows(override));
      if (postWindows.length === 0) continue;
    }
    const occ = occupiedByPost.get(post.id) ?? [];
    const free = subtractIntervals(postWindows, occ);
    for (const interval of free) {
      const startCutoff = Math.max(interval.startMin, nowMin);
      if (startCutoff >= interval.endMin) continue;
      const chunks = chunkInterval({ startMin: startCutoff, endMin: interval.endMin }, duration);
      for (const c of chunks) {
        slots.push({
          start_time: stationWallTimeToUtc(dateKey, c.startMin).toISOString(),
          end_time: stationWallTimeToUtc(dateKey, c.endMin).toISOString(),
          post_id: post.id,
        });
      }
    }
  }

  slots.sort((a, b) => a.start_time.localeCompare(b.start_time));
  return { date: dateKey, slots };
}

/**
 * Wraps `computeAvailability` with the active-station guard used by the
 * public endpoint. Throws NotFoundError when the station does not exist or
 * is not active.
 */
export async function computeAvailabilityForActiveStation(args: ComputeAvailabilityArgs): Promise<ComputeAvailabilityResult> {
  const station = await db.query.stations.findFirst({
    where: (s, { eq: e, and: a }) => a(e(s.id, args.stationId), e(s.status, 'active')),
    columns: { id: true },
  });
  if (!station) throw new NotFoundError('Station not found');
  return computeAvailability(args);
}

/**
 * Verifies that a (post_id, start_time, durationMin) combination is still
 * free at booking time. Returns the matching `AvailabilitySlot` or `null`
 * if it has been taken, the bay is inactive, or the requested window has
 * since fallen outside the station's open hours.
 *
 * Caller is expected to wrap this and the subsequent INSERT in a transaction
 * with the appropriate row locks (SELECT FOR UPDATE on the station_posts row
 * is the cheapest way to serialize bookings on the same bay).
 */
export async function findMatchingAvailabilitySlot(
  stationId: string,
  startTimeIso: string,
  durationMin: number,
  postId?: string | null,
): Promise<AvailabilitySlot | null> {
  const start = new Date(startTimeIso);
  if (Number.isNaN(start.getTime())) return null;
  /* Station-local calendar date — a 21:00 Toronto slot is already the next
   * day in UTC, so slicing the ISO string would query the wrong day. */
  const dateKey = stationDateKey(start);
  const result = await computeAvailability({ stationId, date: dateKey, durationMin });
  const candidates = postId
    ? result.slots.filter((s) => s.post_id === postId)
    : result.slots;
  return candidates.find((s) => s.start_time === start.toISOString()) ?? null;
}
