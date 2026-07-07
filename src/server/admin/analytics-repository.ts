/**
 * Data access functions for the admin analytics timeseries endpoints.
 * One function per metric; all return a sparse series that the service layer gap-fills.
 */
import { and, eq, gte, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, users, stations, supportTickets, ratings } from '@/lib/db/schema';
import { formatDateUTC } from '@/validators/shared';

/**
 * Lookup map for DATE_TRUNC granularity values.
 * Indirection makes the allowed set explicit and auditable; values are safe
 * (Zod enum-constrained at the call site) but the map guards against future
 * refactors accidentally passing an unsanitised string to sql.raw().
 */
const GROUP_BY_SQL: Record<'day' | 'week' | 'month', string> = {
  day: "'day'",
  week: "'week'",
  month: "'month'",
};

/**
 * A single point in a timeseries.
 * `value` is a number for count metrics and a decimal string for monetary/average metrics.
 */
export type SeriesPoint = {
  date: string;
  value: number | string;
};

/**
 * Returns completed-reservation counts grouped by the requested granularity.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with count as number.
 */
export async function getTransactionsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'completed'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? 0 }));
}

/**
 * Returns total revenue (amount_paid) for completed reservations grouped by granularity.
 * Values are decimal strings.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with revenue as decimal string.
 */
export async function getRevenueSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`,
      value: sql<string>`COALESCE(SUM(${reservations.amount_paid}), 0.00)::numeric::text`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'completed'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? '0.00' }));
}

/**
 * Returns total platform retained amounts for completed reservations grouped by granularity.
 * Values are decimal strings.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with commission amount as decimal string.
 */
export async function getCommissionsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`,
      value: sql<string>`COALESCE(SUM(${reservations.platform_total_retained}), 0.00)::numeric::text`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'completed'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? '0.00' }));
}

/**
 * Returns new client registrations (role = 'client') grouped by granularity.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with registration count as number.
 */
export async function getRegistrationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${users.created_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(users)
    .where(
      and(
        eq(users.role, 'client'),
        gte(users.created_at, from),
        lte(users.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${users.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${users.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? 0 }));
}

/**
 * Returns newly activated stations (status = 'active') grouped by granularity.
 * Filtered and grouped by approved_at - the date the station was approved/activated.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with station count as number.
 */
export async function getStationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${stations.approved_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(stations)
    .where(
      and(
        eq(stations.status, 'active'),
        isNotNull(stations.approved_at),
        gte(stations.approved_at, from),
        lte(stations.approved_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${stations.approved_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${stations.approved_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? 0 }));
}

/**
 * Returns reservation-type entries (entry_type = 'reservation') grouped by granularity.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with reservation count as number.
 */
export async function getReservationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.entry_type, 'reservation'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? 0 }));
}

/**
 * Returns cancelled reservations grouped by granularity.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with cancellation count as number.
 */
export async function getCancellationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'cancelled'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? 0 }));
}

/**
 * Returns support tickets created grouped by granularity (no status filter).
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with support ticket count as number.
 */
export async function getSupportTicketsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${supportTickets.created_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(supportTickets)
    .where(
      and(
        gte(supportTickets.created_at, from),
        lte(supportTickets.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${supportTickets.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${supportTickets.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? 0 }));
}

/**
 * Returns average rating score grouped by granularity.
 * Values are decimal strings rounded to 2 places.
 *
 * @param from    - Start of the period (inclusive).
 * @param to      - End of the period (inclusive).
 * @param groupBy - Time granularity: 'day', 'week', or 'month'.
 * @returns       - Array of date-value pairs with average rating as decimal string.
 */
export async function getAvgRatingSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${ratings.created_at})`,
      value: sql<string>`COALESCE(ROUND(AVG(${ratings.score})::numeric, 2), 0.00)::numeric::text`,
    })
    .from(ratings)
    .where(
      and(
        gte(ratings.created_at, from),
        lte(ratings.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${ratings.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(GROUP_BY_SQL[groupBy])}, ${ratings.created_at})`);

  return rows.map((r) => ({ date: formatDateUTC(r.date instanceof Date ? r.date : new Date(r.date)), value: r.value ?? '0.00' }));
}
