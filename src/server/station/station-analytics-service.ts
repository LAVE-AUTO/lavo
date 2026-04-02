import {
  getDashboardKpis,
  getAnalyticsTimeSeries,
  type DashboardKpis,
  type TimeSeriesPoint,
} from './station-analytics-repository';
import type { StationMetricSlug } from '@/validators/station-analytics';

export type { DashboardKpis, TimeSeriesPoint };


// %%%%% Types %%%%%
// Analytics response types

export type AnalyticsSeriesResult = {
  metric: StationMetricSlug;
  series: TimeSeriesPoint[];
};


// %%%%% Dashboard service %%%%%
// KPI retrieval for station dashboard

/**
 * Returns KPI summary for the station's current calendar month.
 *
 * Delegates to the repository; no additional business logic needed.
 *
 * @param stationId - The station's UUID.
 * @returns         - KPI object.
 */
export async function getStationDashboard(stationId: string): Promise<DashboardKpis> {
  return getDashboardKpis(stationId);
}


// %%%%% Analytics service %%%%%
// Time series retrieval for analytics views

/**
 * Returns a daily time series for the requested metric over the given date range.
 *
 * @param stationId - The station's UUID.
 * @param metric    - One of 'revenue' | 'clients' | 'completed'.
 * @param from      - Start of date range (inclusive).
 * @param to        - End of date range (inclusive).
 * @returns         - Object with metric name and series array.
 */
export async function getStationAnalyticsSeries(
  stationId: string,
  metric: StationMetricSlug,
  from: Date,
  to: Date
): Promise<AnalyticsSeriesResult> {
  const series = await getAnalyticsTimeSeries(stationId, metric, from, to);
  return { metric, series };
}
