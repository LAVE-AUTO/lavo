/**
 * Data access for per-station opening hours and exception dates.
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stationHours, stationHourExceptions, stationConfigs } from '@/lib/db/schema';

export type StationHour = typeof stationHours.$inferSelect;
export type StationHourException = typeof stationHourExceptions.$inferSelect;


// %%%%% Station hours %%%%%

/**
 * Returns the 7 hour rows for a station, ordered by day_of_week ASC.
 * Returns an empty array if none have been configured yet.
 */
export async function listHoursByStation(stationId: string): Promise<StationHour[]> {
  return db.query.stationHours.findMany({
    where: eq(stationHours.station_id, stationId),
    orderBy: (h, { asc }) => [asc(h.day_of_week)],
  });
}

/**
 * Upserts an array of hour rows for a station (one per day_of_week 0-6).
 * Existing rows are replaced; missing days are inserted.
 */
export async function upsertHours(
  stationId: string,
  days: Array<{
    day_of_week: number;
    is_open: boolean;
    morning_start: string | null;
    morning_end: string | null;
    afternoon_start: string | null;
    afternoon_end: string | null;
  }>
): Promise<StationHour[]> {
  const values = days.map((d) => ({
    station_id: stationId,
    day_of_week: d.day_of_week,
    is_open: d.is_open,
    morning_start: d.morning_start ?? null,
    morning_end: d.morning_end ?? null,
    afternoon_start: d.afternoon_start ?? null,
    afternoon_end: d.afternoon_end ?? null,
    updated_at: new Date(),
  }));

  return db
    .insert(stationHours)
    .values(values)
    .onConflictDoUpdate({
      target: [stationHours.station_id, stationHours.day_of_week],
      set: {
        is_open: sql`excluded.is_open`,
        morning_start: sql`excluded.morning_start`,
        morning_end: sql`excluded.morning_end`,
        afternoon_start: sql`excluded.afternoon_start`,
        afternoon_end: sql`excluded.afternoon_end`,
        updated_at: sql`excluded.updated_at`,
      },
    })
    .returning();
}

/**
 * Returns the station config opening/closing times as a fallback backfill.
 * Used when station_hours is empty.
 */
export async function getConfigTimesForStation(
  stationId: string
): Promise<{ opening_time: string | null; closing_time: string | null } | undefined> {
  const config = await db.query.stationConfigs.findFirst({
    where: eq(stationConfigs.id, stationId),
    columns: { opening_time: true, closing_time: true },
  });
  if (!config) return undefined;
  return {
    opening_time: config.opening_time ? String(config.opening_time) : null,
    closing_time: config.closing_time ? String(config.closing_time) : null,
  };
}


// %%%%% Station hour exceptions %%%%%

/**
 * Lists all exception dates for a station, ordered by exception_date ASC.
 */
export async function listExceptionsByStation(stationId: string): Promise<StationHourException[]> {
  return db.query.stationHourExceptions.findMany({
    where: eq(stationHourExceptions.station_id, stationId),
    orderBy: (e, { asc }) => [asc(e.exception_date)],
  });
}

/**
 * Inserts a new exception date. Throws on duplicate (station_id, exception_date).
 */
export type InsertExceptionData = {
  is_open?: boolean;
  open_time?: string | null;
  close_time?: string | null;
};

export async function insertException(
  stationId: string,
  exceptionDate: string,
  reason: string,
  opening?: InsertExceptionData
): Promise<StationHourException> {
  const [row] = await db
    .insert(stationHourExceptions)
    .values({
      station_id: stationId,
      exception_date: exceptionDate,
      reason,
      is_open: opening?.is_open ?? false,
      open_time: opening?.open_time ?? null,
      close_time: opening?.close_time ?? null,
    })
    .returning();
  if (!row) throw new Error('Insert station hour exception failed');
  return row;
}

/**
 * Deletes an exception by id, scoped to the station. Returns true if deleted.
 */
export async function deleteException(stationId: string, exceptionId: string): Promise<boolean> {
  const rows = await db
    .delete(stationHourExceptions)
    .where(
      and(eq(stationHourExceptions.id, exceptionId), eq(stationHourExceptions.station_id, stationId))
    )
    .returning({ id: stationHourExceptions.id });
  return rows.length > 0;
}
