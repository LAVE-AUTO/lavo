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
  stationPosts,
  timeSlots,
} from '@/lib/db/schema';
import { NotFoundError } from '@/lib/errors';

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

/** Build a Date for the given local-day base + minutes-since-midnight. */
function dateAtMinutes(base: Date, minutes: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
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

  const dateAt = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(dateAt.getTime())) {
    return { date: dateKey, slots: [] };
  }
  const dayOfWeek = dateAt.getDay();
  const startOfDay = new Date(dateAt);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

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

  if (exceptionRow) {
    return { date: dateKey, slots: [], closed_reason: 'exception' };
  }
  if (postsRows.length === 0) {
    return { date: dateKey, slots: [], closed_reason: 'no_active_post' };
  }

  /* Build the day's open windows. Prefer per-day station_hours; fall back to
   * station_configs when station_hours has no row for this day.
   *
   * The merchant UI (HoursTab) saves up to 4 columns per day:
   *   morning_start, morning_end, afternoon_start, afternoon_end
   *
   * Real-world data shapes we must support:
   *   - continuous day, no break:  morning_start + afternoon_end (the break
   *     pair is null because the template has no break configured) → one
   *     single window from open to close
   *   - half-day morning only:     morning_start + morning_end
   *   - half-day afternoon only:   afternoon_start + afternoon_end
   *   - morning + afternoon split: all four set, break in between
   */
  const windows: OpenWindow[] = [];
  if (hourRow) {
    if (!hourRow.is_open) {
      return { date: dateKey, slots: [], closed_reason: 'day_closed' };
    }
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
  } else if (configRow) {
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
    const startMin = (row.start_time.getHours() * 60 + row.start_time.getMinutes()) - marginBefore;
    const endMin = (row.end_time.getHours() * 60 + row.end_time.getMinutes()) + marginAfter;
    const list = occupiedByPost.get(row.post_id) ?? [];
    list.push({ startMin, endMin });
    occupiedByPost.set(row.post_id, list);
  }

  /* Block past-time chunks today. */
  const now = new Date();
  const isToday = startOfDay.toDateString() === now.toDateString();
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -Infinity;

  const slots: AvailabilitySlot[] = [];
  for (const post of postsRows) {
    const occ = occupiedByPost.get(post.id) ?? [];
    const free = subtractIntervals(windows, occ);
    for (const interval of free) {
      const startCutoff = Math.max(interval.startMin, nowMin);
      if (startCutoff >= interval.endMin) continue;
      const chunks = chunkInterval({ startMin: startCutoff, endMin: interval.endMin }, duration);
      for (const c of chunks) {
        slots.push({
          start_time: dateAtMinutes(startOfDay, c.startMin).toISOString(),
          end_time: dateAtMinutes(startOfDay, c.endMin).toISOString(),
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
  const dateKey = start.toISOString().slice(0, 10);
  const result = await computeAvailability({ stationId, date: dateKey, durationMin });
  const candidates = postId
    ? result.slots.filter((s) => s.post_id === postId)
    : result.slots;
  return candidates.find((s) => s.start_time === start.toISOString()) ?? null;
}
