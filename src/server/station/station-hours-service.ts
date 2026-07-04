/**
 * Business logic for per-station opening hours and exception dates.
 */
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  deleteException,
  getConfigTimesForStation,
  insertException,
  listExceptionsByStation,
  listHoursByStation,
  upsertHours,
  type StationHour,
  type StationHourException,
} from './station-hours-repository';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function buildBackfillRow(
  stationId: string,
  dayOfWeek: number,
  openTime: string | null,
  closeTime: string | null
): Omit<StationHour, 'updated_at'> {
  return {
    station_id: stationId,
    day_of_week: dayOfWeek,
    is_open: true,
    morning_start: openTime,
    morning_end: null,
    afternoon_start: null,
    afternoon_end: closeTime,
  };
}

/**
 * Returns the 7 hour rows for the station.
 * If none are configured yet, returns synthetic rows from station_configs as a backfill.
 */
export async function getStationHours(stationId: string): Promise<StationHour[]> {
  const rows = await listHoursByStation(stationId);
  if (rows.length > 0) return rows;

  const config = await getConfigTimesForStation(stationId);
  return ALL_DAYS.map((day) => ({
    ...buildBackfillRow(stationId, day, config?.opening_time ?? null, config?.closing_time ?? null),
    updated_at: new Date(0),
  }));
}

export type HourPatch = {
  day_of_week: number;
  is_open: boolean;
  morning_start?: string | null;
  morning_end?: string | null;
  afternoon_start?: string | null;
  afternoon_end?: string | null;
};

/**
 * Upserts opening hours for the station.
 * Validates time ordering when is_open is true.
 */
export async function updateStationHours(
  stationId: string,
  days: HourPatch[]
): Promise<StationHour[]> {
  for (const d of days) {
    if (!d.is_open) continue;
    const { morning_start, morning_end, afternoon_start, afternoon_end } = d;
    if (morning_start && morning_end && morning_start >= morning_end) {
      throw new ValidationError(`Day ${d.day_of_week}: morning_start must be before morning_end`);
    }
    if (morning_end && afternoon_start && morning_end > afternoon_start) {
      throw new ValidationError(`Day ${d.day_of_week}: morning_end must not exceed afternoon_start`);
    }
    if (afternoon_start && afternoon_end && afternoon_start >= afternoon_end) {
      throw new ValidationError(`Day ${d.day_of_week}: afternoon_start must be before afternoon_end`);
    }
  }

  return upsertHours(stationId, days.map((d) => ({
    day_of_week: d.day_of_week,
    is_open: d.is_open,
    // A closed day's times aren't meaningful — clear them so a later
    // open-all-day exception can't pick up stale hours for this day.
    morning_start: d.is_open ? d.morning_start ?? null : null,
    morning_end: d.is_open ? d.morning_end ?? null : null,
    afternoon_start: d.is_open ? d.afternoon_start ?? null : null,
    afternoon_end: d.is_open ? d.afternoon_end ?? null : null,
  })));
}

/**
 * Returns all exception dates for the station, ordered by date ASC.
 */
export async function getStationHourExceptions(stationId: string): Promise<StationHourException[]> {
  return listExceptionsByStation(stationId);
}

/** Status of the station on an exception day, as exposed to the frontend. */
export type ExceptionStatus = 'closed' | 'open_all_day' | 'open_custom';

export type ExceptionOpening = {
  status: ExceptionStatus;
  open_time?: string | null;
  close_time?: string | null;
};

/** The exception row shaped for the API/frontend (derives `status`, trims time seconds). */
export type SerializedHourException = {
  id: string;
  exception_date: string;
  reason: string;
  status: ExceptionStatus;
  open_time: string | null;
  close_time: string | null;
};

/** Postgres `time` returns "HH:MM:SS"; the UI works with "HH:MM". */
function trimTime(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

export function serializeHourException(row: StationHourException): SerializedHourException {
  const status: ExceptionStatus = !row.is_open
    ? 'closed'
    : row.open_time
      ? 'open_custom'
      : 'open_all_day';
  return {
    id: row.id,
    exception_date: row.exception_date,
    reason: row.reason,
    status,
    open_time: trimTime(row.open_time),
    close_time: trimTime(row.close_time),
  };
}

/**
 * Adds an exception date for the station. When `opening` marks the day as open,
 * the station is either open all day or open with special hours.
 * Throws ConflictError if an exception already exists for that date (DB unique constraint).
 */
export async function addStationHourException(
  stationId: string,
  exceptionDate: string,
  reason: string,
  opening?: ExceptionOpening
): Promise<StationHourException> {
  const isOpen = opening ? opening.status !== 'closed' : false;
  const customHours = opening?.status === 'open_custom';
  if (customHours) {
    const { open_time, close_time } = opening ?? {};
    if (!open_time || !close_time || close_time <= open_time) {
      throw new ValidationError('close_time must be after open_time for open_custom exceptions');
    }
  }
  try {
    return await insertException(stationId, exceptionDate, reason, {
      is_open: isOpen,
      open_time: customHours ? opening?.open_time ?? null : null,
      close_time: customHours ? opening?.close_time ?? null : null,
    });
  } catch (err) {
    // PostgreSQL unique_violation code is '23505'.
    if (err instanceof Error && (err as Error & { code?: string }).code === '23505') {
      throw new ConflictError('An exception already exists for this date');
    }
    throw err;
  }
}

/**
 * Removes an exception date by id. Throws NotFoundError if absent or not owned by station.
 */
export async function removeStationHourException(
  stationId: string,
  exceptionId: string
): Promise<void> {
  const deleted = await deleteException(stationId, exceptionId);
  if (!deleted) throw new NotFoundError('Hour exception not found');
}
