import { and, eq, sql } from 'drizzle-orm';

import { db } from '@/lib/db';
import { reservations, ratings } from '@/lib/db/schema';
import type { StationMetricSlug } from '@/validators/station-analytics';


// %%%%% Types %%%%%
// KPI and time series data types

export type DashboardKpis = {
  total_revenue: string;
  total_clients: number;
  total_completed: number;
  average_rating: string | null;
  pending_count: number;
  month: string;
};

export type TimeSeriesPoint = {
  date: string;
  value: string;
};


// %%%%% KPI queries %%%%%
// Dashboard metrics aggregation by month

/**
 * Returns KPI summary for the station's current calendar month.
 *
 * Metrics:
 *   - total_revenue:   SUM of amount_paid for completed entries this month
 *   - total_clients:   COUNT(DISTINCT user_id) for completed entries this month
 *   - total_completed: COUNT of entries with completed_at IS NOT NULL this month
 *   - average_rating:  AVG of ratings.score for this station this month (null if none)
 *   - pending_count:   COUNT of entries with status='confirmed' (no time filter)
 *
 * Uses completed_at for time filtering on reservations.
 * Uses created_at on ratings for the monthly rating filter.
 *
 * @param stationId - The station's UUID.
 * @returns         - KPI object with current-month data.
 */
export async function getDashboardKpis(stationId: string): Promise<DashboardKpis> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  // Start and end of current month in UTC
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)); // exclusive upper bound

  const [completedRows, ratingsRows, pendingRows] = await Promise.all([
    // KPIs from completed reservations this month
    db
      .select({
        total_revenue: sql<string>`COALESCE(SUM(${reservations.amount_paid}), 0)::text`,
        total_clients: sql<number>`COUNT(DISTINCT ${reservations.user_id})::int`,
        total_completed: sql<number>`COUNT(*)::int`,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.station_id, stationId),
          sql`${reservations.completed_at} IS NOT NULL`,
          sql`${reservations.completed_at} >= ${monthStart}`,
          sql`${reservations.completed_at} < ${monthEnd}`
        )
      ),

    // Average rating for this station this month
    db
      .select({
        average_rating: sql<string | null>`ROUND(AVG(${ratings.score})::numeric, 1)::text`,
      })
      .from(ratings)
      .where(
        and(
          eq(ratings.station_id, stationId),
          sql`${ratings.created_at} >= ${monthStart}`,
          sql`${ratings.created_at} < ${monthEnd}`
        )
      ),

    // Pending (confirmed) entries — no time filter
    db
      .select({
        pending_count: sql<number>`COUNT(*)::int`,
      })
      .from(reservations)
      .where(
        and(
          eq(reservations.station_id, stationId),
          eq(reservations.status, 'confirmed')
        )
      ),
  ]);

  const completed = completedRows[0];
  const rating = ratingsRows[0];
  const pending = pendingRows[0];

  return {
    total_revenue: completed?.total_revenue ?? '0',
    total_clients: completed?.total_clients ?? 0,
    total_completed: completed?.total_completed ?? 0,
    average_rating: rating?.average_rating ?? null,
    pending_count: pending?.pending_count ?? 0,
    month: monthStr,
  };
}


// %%%%% Time series queries %%%%%
// Daily metrics by date range

/**
 * Returns a daily time series for a given metric over a date range.
 *
 * Supported metrics:
 *   - revenue:   daily SUM of amount_paid for completed entries
 *   - clients:   daily COUNT(DISTINCT user_id) for completed entries
 *   - completed: daily COUNT of completed entries
 *
 * Groups by completed_at::date. Only rows with completed_at in [from, to] are included.
 * Sparse result: days with no entries are omitted (caller may fill gaps if needed).
 *
 * Uses raw SQL via Drizzle sql`` template for the GROUP BY aggregate.
 *
 * @param stationId - The station's UUID.
 * @param metric    - One of 'revenue' | 'clients' | 'completed'.
 * @param from      - Start of date range (inclusive).
 * @param to        - End of date range (inclusive).
 * @returns         - Array of { date: YYYY-MM-DD, value: string } points, ordered by date ASC.
 */
export async function getAnalyticsTimeSeries(
  stationId: string,
  metric: StationMetricSlug,
  from: Date,
  to: Date
): Promise<TimeSeriesPoint[]> {
  let valueExpr: ReturnType<typeof sql>;

  if (metric === 'revenue') {
    valueExpr = sql`COALESCE(SUM(${reservations.amount_paid}), 0)::text`;
  } else if (metric === 'clients') {
    valueExpr = sql`COUNT(DISTINCT ${reservations.user_id})::text`;
  } else {
    // completed
    valueExpr = sql`COUNT(*)::text`;
  }

  const rows = await db
    .select({
      date: sql<string>`(${reservations.completed_at}::date)::text`,
      value: valueExpr,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.station_id, stationId),
        sql`${reservations.completed_at} IS NOT NULL`,
        sql`${reservations.completed_at} >= ${from}`,
        sql`${reservations.completed_at} <= ${to}`
      )
    )
    .groupBy(sql`${reservations.completed_at}::date`)
    .orderBy(sql`${reservations.completed_at}::date ASC`);

  return rows.map((r) => ({ date: r.date, value: r.value }));
}
