/**
 * Data access functions for the admin analytics timeseries endpoints.
 * One function per metric; all return a sparse series that the service layer gap-fills.
 */
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, users, stations, supportTickets, ratings } from '@/lib/db/schema';

/** A single point in a timeseries. `value` is a number for count metrics
 *  and a decimal string for monetary/average metrics. */
export type SeriesPoint = {
  date: string;
  value: number | string;
};

/** Internal row returned by DATE_TRUNC queries. */
type RawSeriesRow = {
  date: Date | string;
  value: string | number | null;
};

/** Normalises a DATE_TRUNC result to a YYYY-MM-DD string. */
function toDateString(raw: Date | string): string {
  const d = raw instanceof Date ? raw : new Date(raw);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns completed-reservation counts grouped by the requested granularity.
 */
export async function getTransactionsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`,
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
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? 0 }));
}

/**
 * Returns total revenue (amount_paid) for completed reservations grouped by granularity.
 * Values are decimal strings.
 */
export async function getRevenueSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`,
      value: sql<string>`COALESCE(SUM(${reservations.amount_paid}), 0)::numeric::text`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'completed'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? '0.00' }));
}

/**
 * Returns total commissions for completed reservations grouped by granularity.
 * Values are decimal strings.
 */
export async function getCommissionsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`,
      value: sql<string>`COALESCE(SUM(${reservations.commission_amount}), 0)::numeric::text`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'completed'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? '0.00' }));
}

/**
 * Returns new client registrations (role = 'client') grouped by granularity.
 */
export async function getRegistrationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${users.created_at})`,
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
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${users.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${users.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? 0 }));
}

/**
 * Returns newly activated stations (status = 'active') grouped by granularity.
 */
export async function getStationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${stations.created_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(stations)
    .where(
      and(
        eq(stations.status, 'active'),
        gte(stations.created_at, from),
        lte(stations.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${stations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${stations.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? 0 }));
}

/**
 * Returns reservation-type entries (entry_type = 'reservation') grouped by granularity.
 */
export async function getReservationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`,
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
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? 0 }));
}

/**
 * Returns cancelled reservations grouped by granularity.
 */
export async function getCancellationsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`,
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
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${reservations.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? 0 }));
}

/**
 * Returns support tickets created grouped by granularity (no status filter).
 */
export async function getSupportTicketsSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${supportTickets.created_at})`,
      value: sql<number>`COUNT(*)::int`,
    })
    .from(supportTickets)
    .where(
      and(
        gte(supportTickets.created_at, from),
        lte(supportTickets.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${supportTickets.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${supportTickets.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? 0 }));
}

/**
 * Returns average rating score grouped by granularity.
 * Values are decimal strings rounded to 2 places.
 */
export async function getAvgRatingSeries(
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  const rows = await db
    .select({
      date: sql<Date>`DATE_TRUNC(${sql.raw(groupBy)}, ${ratings.created_at})`,
      value: sql<string>`COALESCE(ROUND(AVG(${ratings.score})::numeric, 2), 0)::numeric::text`,
    })
    .from(ratings)
    .where(
      and(
        gte(ratings.created_at, from),
        lte(ratings.created_at, to)
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${ratings.created_at})`)
    .orderBy(sql`DATE_TRUNC(${sql.raw(groupBy)}, ${ratings.created_at})`);

  return rows.map((r) => ({ date: toDateString(r.date), value: r.value ?? '0.00' }));
}
