/**
 * Service for the admin analytics timeseries endpoints.
 * Dispatches to the correct repository function by metric slug and gap-fills the series.
 */
import type { MetricSlug } from '@/validators/analytics';
import type { SeriesPoint } from './analytics-repository';
import {
  getTransactionsSeries,
  getRevenueSeries,
  getCommissionsSeries,
  getRegistrationsSeries,
  getStationsSeries,
  getReservationsSeries,
  getCancellationsSeries,
  getSupportTicketsSeries,
  getAvgRatingSeries,
} from './analytics-repository';

/** Metrics whose `value` field is a decimal string (monetary or average). */
const STRING_VALUE_METRICS: ReadonlySet<MetricSlug> = new Set([
  'revenue',
  'commissions',
  'avg-rating',
]);

/** A timeseries response data object. */
export type AnalyticsData = {
  metric: MetricSlug;
  group_by: 'day' | 'week' | 'month';
  period: {
    from: string;
    to: string;
  };
  series: SeriesPoint[];
};

/**
 * Returns the full timeseries for the given metric, date range, and granularity.
 *
 * Gap-fills missing periods so the frontend always receives a contiguous series.
 * Count metrics default missing periods to `0`; monetary/average metrics to `"0.00"`.
 *
 * @param metric   - One of the 9 valid metric slugs.
 * @param from     - Inclusive start of the period.
 * @param to       - Inclusive end of the period.
 * @param groupBy  - Granularity: 'day', 'week', or 'month'.
 */
export async function getAnalyticsSeries(
  metric: MetricSlug,
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<AnalyticsData> {
  const sparseSeries = await fetchSeries(metric, from, to, groupBy);
  const series = fillGaps(sparseSeries, from, to, groupBy, STRING_VALUE_METRICS.has(metric));

  return {
    metric,
    group_by: groupBy,
    period: {
      from: formatDate(from),
      to: formatDate(to),
    },
    series,
  };
}

/**
 * Dispatches to the correct repository function based on the metric slug.
 */
async function fetchSeries(
  metric: MetricSlug,
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month'
): Promise<SeriesPoint[]> {
  switch (metric) {
    case 'transactions':
      return getTransactionsSeries(from, to, groupBy);
    case 'revenue':
      return getRevenueSeries(from, to, groupBy);
    case 'commissions':
      return getCommissionsSeries(from, to, groupBy);
    case 'registrations':
      return getRegistrationsSeries(from, to, groupBy);
    case 'stations':
      return getStationsSeries(from, to, groupBy);
    case 'reservations':
      return getReservationsSeries(from, to, groupBy);
    case 'cancellations':
      return getCancellationsSeries(from, to, groupBy);
    case 'support-tickets':
      return getSupportTicketsSeries(from, to, groupBy);
    case 'avg-rating':
      return getAvgRatingSeries(from, to, groupBy);
  }
}

/**
 * Generates all period boundaries within [from, to] at the given granularity
 * and merges with the sparse series from the DB, substituting zeros for gaps.
 *
 * @param sparse        - Sparse series returned by the repository.
 * @param from          - Inclusive range start.
 * @param to            - Inclusive range end.
 * @param groupBy       - Granularity determining step size.
 * @param isStringValue - When true, missing points are filled with "0.00" instead of 0.
 */
function fillGaps(
  sparse: SeriesPoint[],
  from: Date,
  to: Date,
  groupBy: 'day' | 'week' | 'month',
  isStringValue: boolean
): SeriesPoint[] {
  // Build a lookup keyed by YYYY-MM-DD date string for O(1) access.
  const lookup = new Map<string, number | string>();
  for (const point of sparse) {
    lookup.set(point.date, point.value);
  }

  const zeroValue: number | string = isStringValue ? '0.00' : 0;
  const result: SeriesPoint[] = [];

  // Iterate from the start of the first truncated period through to `to`.
  const cursor = truncateToPeriod(new Date(from), groupBy);
  while (cursor <= to) {
    const key = formatDate(cursor);
    result.push({
      date: key,
      value: lookup.has(key) ? lookup.get(key)! : zeroValue,
    });
    advanceCursor(cursor, groupBy);
  }

  return result;
}

/**
 * Returns a new Date truncated to the start of the given period in UTC.
 * - day   → start of that UTC day
 * - week  → start of the ISO week (Monday) containing the date
 * - month → first day of the UTC month
 */
function truncateToPeriod(date: Date, groupBy: 'day' | 'week' | 'month'): Date {
  const d = new Date(date);
  if (groupBy === 'day') {
    d.setUTCHours(0, 0, 0, 0);
  } else if (groupBy === 'week') {
    // ISO week starts on Monday; getUTCDay() returns 0=Sun … 6=Sat
    const dayOfWeek = d.getUTCDay();
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setUTCDate(d.getUTCDate() - daysToMonday);
    d.setUTCHours(0, 0, 0, 0);
  } else {
    // month
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
  }
  return d;
}

/**
 * Advances `cursor` in-place by one period step.
 * Uses UTC arithmetic to avoid DST issues.
 */
function advanceCursor(cursor: Date, groupBy: 'day' | 'week' | 'month'): void {
  if (groupBy === 'day') {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  } else if (groupBy === 'week') {
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  } else {
    // month — advance to the first day of the next month
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
}

/**
 * Formats a Date as a YYYY-MM-DD string using UTC components.
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
