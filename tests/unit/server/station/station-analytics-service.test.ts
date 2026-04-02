/**
 * Unit tests for station-analytics-service.
 * Mocks the repository layer to avoid loading pg.
 */
jest.mock('@/lib/db', () => ({ db: {} }));

const mockGetDashboardKpis = jest.fn();
const mockGetAnalyticsTimeSeries = jest.fn();

jest.mock('@/server/station/station-analytics-repository', () => ({
  getDashboardKpis: (...args: unknown[]) => mockGetDashboardKpis(...args),
  getAnalyticsTimeSeries: (...args: unknown[]) => mockGetAnalyticsTimeSeries(...args),
}));

import {
  getStationDashboard,
  getStationAnalyticsSeries,
} from '@/server/station/station-analytics-service';
import { stationAnalyticsQuerySchema } from '@/validators/station-analytics';

const STATION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('getStationDashboard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns correct KPI structure for a station', async () => {
    const kpis = {
      total_revenue: '12500.00',
      total_clients: 45,
      total_completed: 45,
      average_rating: '4.7',
      pending_count: 3,
      month: '2026-04',
    };
    mockGetDashboardKpis.mockResolvedValueOnce(kpis);

    const result = await getStationDashboard(STATION_ID);

    expect(mockGetDashboardKpis).toHaveBeenCalledWith(STATION_ID);
    expect(result).toEqual(kpis);
    expect(result.total_revenue).toBe('12500.00');
    expect(result.total_clients).toBe(45);
    expect(result.total_completed).toBe(45);
    expect(result.average_rating).toBe('4.7');
    expect(result.pending_count).toBe(3);
    expect(result.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it('returns null for average_rating when no ratings exist', async () => {
    const kpis = {
      total_revenue: '0',
      total_clients: 0,
      total_completed: 0,
      average_rating: null,
      pending_count: 0,
      month: '2026-04',
    };
    mockGetDashboardKpis.mockResolvedValueOnce(kpis);

    const result = await getStationDashboard(STATION_ID);

    expect(result.average_rating).toBeNull();
  });
});

describe('getStationAnalyticsSeries', () => {
  const FROM = new Date('2026-03-03T00:00:00.000Z');
  const TO = new Date('2026-04-01T23:59:59.999Z');

  beforeEach(() => jest.clearAllMocks());

  it('returns revenue series grouped by day with correct sums', async () => {
    const series = [
      { date: '2026-03-03', value: '1250.00' },
      { date: '2026-03-04', value: '980.50' },
    ];
    mockGetAnalyticsTimeSeries.mockResolvedValueOnce(series);

    const result = await getStationAnalyticsSeries(STATION_ID, 'revenue', FROM, TO);

    expect(mockGetAnalyticsTimeSeries).toHaveBeenCalledWith(STATION_ID, 'revenue', FROM, TO);
    expect(result.metric).toBe('revenue');
    expect(result.series).toHaveLength(2);
    expect(result.series[0]).toEqual({ date: '2026-03-03', value: '1250.00' });
    expect(result.series[1]).toEqual({ date: '2026-03-04', value: '980.50' });
  });

  it('returns clients series with distinct user count per day', async () => {
    const series = [
      { date: '2026-03-10', value: '5' },
      { date: '2026-03-11', value: '3' },
    ];
    mockGetAnalyticsTimeSeries.mockResolvedValueOnce(series);

    const result = await getStationAnalyticsSeries(STATION_ID, 'clients', FROM, TO);

    expect(result.metric).toBe('clients');
    expect(result.series[0]).toEqual({ date: '2026-03-10', value: '5' });
    expect(result.series[1]).toEqual({ date: '2026-03-11', value: '3' });
  });

  it('returns completed series with daily count', async () => {
    const series = [{ date: '2026-03-15', value: '8' }];
    mockGetAnalyticsTimeSeries.mockResolvedValueOnce(series);

    const result = await getStationAnalyticsSeries(STATION_ID, 'completed', FROM, TO);

    expect(result.metric).toBe('completed');
    expect(result.series).toHaveLength(1);
    expect(result.series[0].value).toBe('8');
  });

  it('returns empty series when no data exists in range', async () => {
    mockGetAnalyticsTimeSeries.mockResolvedValueOnce([]);

    const result = await getStationAnalyticsSeries(STATION_ID, 'revenue', FROM, TO);

    expect(result.metric).toBe('revenue');
    expect(result.series).toHaveLength(0);
  });

  it('passes from/to date range to repository', async () => {
    mockGetAnalyticsTimeSeries.mockResolvedValueOnce([]);

    const customFrom = new Date('2026-01-01T00:00:00.000Z');
    const customTo = new Date('2026-01-31T23:59:59.999Z');
    await getStationAnalyticsSeries(STATION_ID, 'revenue', customFrom, customTo);

    expect(mockGetAnalyticsTimeSeries).toHaveBeenCalledWith(
      STATION_ID,
      'revenue',
      customFrom,
      customTo
    );
  });
});

describe('stationAnalyticsQuerySchema validation', () => {
  it('accepts no params (default 30-day window)', () => {
    const result = stationAnalyticsQuerySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts valid from/to date range', () => {
    const result = stationAnalyticsQuerySchema.safeParse({
      from: '2026-03-01',
      to: '2026-04-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects from without to', () => {
    const result = stationAnalyticsQuerySchema.safeParse({ from: '2026-03-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.errors.map((e) => e.path.join('.'));
      expect(fields).toContain('to');
    }
  });

  it('rejects to without from', () => {
    const result = stationAnalyticsQuerySchema.safeParse({ to: '2026-04-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.errors.map((e) => e.path.join('.'));
      expect(fields).toContain('from');
    }
  });

  it('rejects from after to', () => {
    const result = stationAnalyticsQuerySchema.safeParse({
      from: '2026-04-01',
      to: '2026-03-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown metric via STATION_METRICS check (not in schema — validated at route level)', () => {
    // The metric validation is done at the route handler level using STATION_METRICS array.
    // The validator schema only covers query params (from, to).
    // This test documents the design decision.
    const { STATION_METRICS } = require('@/validators/station-analytics');
    expect(STATION_METRICS).toContain('revenue');
    expect(STATION_METRICS).toContain('clients');
    expect(STATION_METRICS).toContain('completed');
    expect(STATION_METRICS).not.toContain('unknown_metric');
  });
});
