/**
 * Unit tests for getAnalyticsSeries in analytics-service.
 * Covers: metric dispatch, gap-filling (day/week/month), zero-value types,
 * period formatting, and sparse series handling.
 * @jest-environment node
 */
const mockGetTransactionsSeries = jest.fn();
const mockGetRevenueSeries = jest.fn();
const mockGetCommissionsSeries = jest.fn();
const mockGetRegistrationsSeries = jest.fn();
const mockGetStationsSeries = jest.fn();
const mockGetReservationsSeries = jest.fn();
const mockGetCancellationsSeries = jest.fn();
const mockGetSupportTicketsSeries = jest.fn();
const mockGetAvgRatingSeries = jest.fn();

jest.mock('@/server/admin/analytics-repository', () => ({
  getTransactionsSeries: (...args: unknown[]) => mockGetTransactionsSeries(...args),
  getRevenueSeries: (...args: unknown[]) => mockGetRevenueSeries(...args),
  getCommissionsSeries: (...args: unknown[]) => mockGetCommissionsSeries(...args),
  getRegistrationsSeries: (...args: unknown[]) => mockGetRegistrationsSeries(...args),
  getStationsSeries: (...args: unknown[]) => mockGetStationsSeries(...args),
  getReservationsSeries: (...args: unknown[]) => mockGetReservationsSeries(...args),
  getCancellationsSeries: (...args: unknown[]) => mockGetCancellationsSeries(...args),
  getSupportTicketsSeries: (...args: unknown[]) => mockGetSupportTicketsSeries(...args),
  getAvgRatingSeries: (...args: unknown[]) => mockGetAvgRatingSeries(...args),
}));

import { getAnalyticsSeries } from '@/server/admin/analytics-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a UTC Date for the given YYYY-MM-DD string at start of day. */
function utcDate(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns a UTC Date for the given YYYY-MM-DD string at end of day. */
function utcEndOfDay(dateStr: string): Date {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

// ---------------------------------------------------------------------------
// Metric dispatch: each metric routes to the correct repository function
// ---------------------------------------------------------------------------

describe('getAnalyticsSeries - metric dispatch', () => {
  const from = utcDate('2026-01-01');
  const to = utcEndOfDay('2026-01-03');

  beforeEach(() => {
    jest.clearAllMocks();
    // Default all mocks to return an empty series.
    mockGetTransactionsSeries.mockResolvedValue([]);
    mockGetRevenueSeries.mockResolvedValue([]);
    mockGetCommissionsSeries.mockResolvedValue([]);
    mockGetRegistrationsSeries.mockResolvedValue([]);
    mockGetStationsSeries.mockResolvedValue([]);
    mockGetReservationsSeries.mockResolvedValue([]);
    mockGetCancellationsSeries.mockResolvedValue([]);
    mockGetSupportTicketsSeries.mockResolvedValue([]);
    mockGetAvgRatingSeries.mockResolvedValue([]);
  });

  it('dispatches "transactions" to getTransactionsSeries', async () => {
    await getAnalyticsSeries('transactions', from, to, 'day');
    expect(mockGetTransactionsSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetRevenueSeries).not.toHaveBeenCalled();
  });

  it('dispatches "revenue" to getRevenueSeries', async () => {
    await getAnalyticsSeries('revenue', from, to, 'day');
    expect(mockGetRevenueSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });

  it('dispatches "commissions" to getCommissionsSeries', async () => {
    await getAnalyticsSeries('commissions', from, to, 'day');
    expect(mockGetCommissionsSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });

  it('dispatches "registrations" to getRegistrationsSeries', async () => {
    await getAnalyticsSeries('registrations', from, to, 'day');
    expect(mockGetRegistrationsSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });

  it('dispatches "stations" to getStationsSeries', async () => {
    await getAnalyticsSeries('stations', from, to, 'day');
    expect(mockGetStationsSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });

  it('dispatches "reservations" to getReservationsSeries', async () => {
    await getAnalyticsSeries('reservations', from, to, 'day');
    expect(mockGetReservationsSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });

  it('dispatches "cancellations" to getCancellationsSeries', async () => {
    await getAnalyticsSeries('cancellations', from, to, 'day');
    expect(mockGetCancellationsSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });

  it('dispatches "support-tickets" to getSupportTicketsSeries', async () => {
    await getAnalyticsSeries('support-tickets', from, to, 'day');
    expect(mockGetSupportTicketsSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });

  it('dispatches "avg-rating" to getAvgRatingSeries', async () => {
    await getAnalyticsSeries('avg-rating', from, to, 'day');
    expect(mockGetAvgRatingSeries).toHaveBeenCalledWith(from, to, 'day');
    expect(mockGetTransactionsSeries).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Gap-filling: day granularity
// ---------------------------------------------------------------------------

describe('getAnalyticsSeries - gap-filling with group_by=day', () => {
  // Range: 2026-03-01 to 2026-03-03 (3 days).
  const from = utcDate('2026-03-01');
  const to = utcEndOfDay('2026-03-03');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fills missing days with 0 for count metrics when the DB returns a sparse series', async () => {
    // DB only has data for 2026-03-02; 2026-03-01 and 2026-03-03 are missing.
    mockGetTransactionsSeries.mockResolvedValueOnce([
      { date: '2026-03-02', value: 7 },
    ]);

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result.series).toHaveLength(3);
    expect(result.series[0]).toEqual({ date: '2026-03-01', value: 0 });
    expect(result.series[1]).toEqual({ date: '2026-03-02', value: 7 });
    expect(result.series[2]).toEqual({ date: '2026-03-03', value: 0 });
  });

  it('fills missing days with "0.00" for monetary metrics when the DB returns a sparse series', async () => {
    // DB only has data for 2026-03-02.
    mockGetRevenueSeries.mockResolvedValueOnce([
      { date: '2026-03-02', value: '150.75' },
    ]);

    const result = await getAnalyticsSeries('revenue', from, to, 'day');

    expect(result.series).toHaveLength(3);
    expect(result.series[0]).toEqual({ date: '2026-03-01', value: '0.00' });
    expect(result.series[1]).toEqual({ date: '2026-03-02', value: '150.75' });
    expect(result.series[2]).toEqual({ date: '2026-03-03', value: '0.00' });
  });

  it('fills missing days with "0.00" for commissions when the DB returns a sparse series', async () => {
    mockGetCommissionsSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('commissions', from, to, 'day');

    expect(result.series).toHaveLength(3);
    for (const point of result.series) {
      expect(point.value).toBe('0.00');
    }
  });

  it('fills missing days with "0.00" for avg-rating when the DB returns a sparse series', async () => {
    mockGetAvgRatingSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('avg-rating', from, to, 'day');

    expect(result.series).toHaveLength(3);
    for (const point of result.series) {
      expect(point.value).toBe('0.00');
    }
  });

  it('returns the full series with zero-filled gaps when the DB returns an empty series', async () => {
    mockGetTransactionsSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result.series).toHaveLength(3);
    for (const point of result.series) {
      expect(point.value).toBe(0);
    }
  });

  it('preserves DB values and does not insert duplicates for fully populated series', async () => {
    mockGetTransactionsSeries.mockResolvedValueOnce([
      { date: '2026-03-01', value: 2 },
      { date: '2026-03-02', value: 5 },
      { date: '2026-03-03', value: 1 },
    ]);

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result.series).toHaveLength(3);
    expect(result.series[0]).toEqual({ date: '2026-03-01', value: 2 });
    expect(result.series[1]).toEqual({ date: '2026-03-02', value: 5 });
    expect(result.series[2]).toEqual({ date: '2026-03-03', value: 1 });
  });

  it('series dates match exactly the expected range at day granularity', async () => {
    mockGetTransactionsSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    const dates = result.series.map((p) => p.date);
    expect(dates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });
});

// ---------------------------------------------------------------------------
// Gap-filling: week granularity
// ---------------------------------------------------------------------------

describe('getAnalyticsSeries - gap-filling with group_by=week', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates one point per ISO week (Monday) within the range', async () => {
    // Range: 2026-03-02 (Mon) to 2026-03-15 (Sun) - 2 full ISO weeks.
    const from = utcDate('2026-03-02');
    const to = utcEndOfDay('2026-03-15');

    mockGetTransactionsSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('transactions', from, to, 'week');

    // Expect at least 2 week buckets.
    expect(result.series.length).toBeGreaterThanOrEqual(2);
    // All series dates should be Mondays (ISO week start).
    for (const point of result.series) {
      const d = new Date(point.date + 'T00:00:00Z');
      expect(d.getUTCDay()).toBe(1); // 1 = Monday
    }
  });

  it('fills missing weeks with 0 for count metrics', async () => {
    // Range covers 2 ISO weeks starting 2026-03-02 and 2026-03-09.
    const from = utcDate('2026-03-02');
    const to = utcEndOfDay('2026-03-15');

    mockGetTransactionsSeries.mockResolvedValueOnce([
      { date: '2026-03-09', value: 12 },
    ]);

    const result = await getAnalyticsSeries('transactions', from, to, 'week');

    const point09 = result.series.find((p) => p.date === '2026-03-09');
    const point02 = result.series.find((p) => p.date === '2026-03-02');
    expect(point09?.value).toBe(12);
    expect(point02?.value).toBe(0);
  });

  it('fills missing weeks with "0.00" for monetary metrics', async () => {
    const from = utcDate('2026-03-02');
    const to = utcEndOfDay('2026-03-15');

    mockGetRevenueSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('revenue', from, to, 'week');

    for (const point of result.series) {
      expect(point.value).toBe('0.00');
    }
  });
});

// ---------------------------------------------------------------------------
// Gap-filling: month granularity
// ---------------------------------------------------------------------------

describe('getAnalyticsSeries - gap-filling with group_by=month', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('generates one point per calendar month within the range', async () => {
    // Range: Jan to Mar 2026 - 3 months.
    const from = utcDate('2026-01-01');
    const to = utcEndOfDay('2026-03-31');

    mockGetTransactionsSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('transactions', from, to, 'month');

    expect(result.series.length).toBeGreaterThanOrEqual(3);
    const dates = result.series.map((p) => p.date);
    expect(dates).toContain('2026-01-01');
    expect(dates).toContain('2026-02-01');
    expect(dates).toContain('2026-03-01');
  });

  it('all series dates are on the first day of the month', async () => {
    const from = utcDate('2026-01-01');
    const to = utcEndOfDay('2026-03-31');

    mockGetTransactionsSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('transactions', from, to, 'month');

    for (const point of result.series) {
      expect(point.date).toMatch(/-01$/); // ends in -01
    }
  });

  it('fills missing months with 0 for count metrics', async () => {
    const from = utcDate('2026-01-01');
    const to = utcEndOfDay('2026-03-31');

    // Only February has data.
    mockGetTransactionsSeries.mockResolvedValueOnce([
      { date: '2026-02-01', value: 20 },
    ]);

    const result = await getAnalyticsSeries('transactions', from, to, 'month');

    const jan = result.series.find((p) => p.date === '2026-01-01');
    const feb = result.series.find((p) => p.date === '2026-02-01');
    const mar = result.series.find((p) => p.date === '2026-03-01');
    expect(jan?.value).toBe(0);
    expect(feb?.value).toBe(20);
    expect(mar?.value).toBe(0);
  });

  it('fills missing months with "0.00" for monetary metrics', async () => {
    const from = utcDate('2026-01-01');
    const to = utcEndOfDay('2026-03-31');

    mockGetRevenueSeries.mockResolvedValueOnce([]);

    const result = await getAnalyticsSeries('revenue', from, to, 'month');

    for (const point of result.series) {
      expect(point.value).toBe('0.00');
    }
  });
});

// ---------------------------------------------------------------------------
// Output shape: period formatting
// ---------------------------------------------------------------------------

describe('getAnalyticsSeries - period output', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTransactionsSeries.mockResolvedValue([]);
  });

  it('formats period.from as YYYY-MM-DD', async () => {
    const from = utcDate('2026-01-15');
    const to = utcEndOfDay('2026-01-20');

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.period.from).toBe('2026-01-15');
  });

  it('formats period.to as YYYY-MM-DD', async () => {
    const from = utcDate('2026-01-15');
    const to = utcEndOfDay('2026-01-20');

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.period.to).toBe('2026-01-20');
  });

  it('includes the correct metric slug in the response', async () => {
    const from = utcDate('2026-01-15');
    const to = utcEndOfDay('2026-01-20');

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result.metric).toBe('transactions');
  });

  it('includes the correct group_by in the response', async () => {
    const from = utcDate('2026-01-15');
    const to = utcEndOfDay('2026-01-20');

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result.group_by).toBe('day');
  });

  it('returns the result with all required top-level keys', async () => {
    const from = utcDate('2026-01-15');
    const to = utcEndOfDay('2026-01-20');

    const result = await getAnalyticsSeries('transactions', from, to, 'day');

    expect(result).toHaveProperty('metric');
    expect(result).toHaveProperty('group_by');
    expect(result).toHaveProperty('period');
    expect(result.period).toHaveProperty('from');
    expect(result.period).toHaveProperty('to');
    expect(result).toHaveProperty('series');
    expect(Array.isArray(result.series)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Zero-value type invariants across all string-value metrics
// ---------------------------------------------------------------------------

describe('getAnalyticsSeries - zero-value type invariants', () => {
  const from = utcDate('2026-03-01');
  const to = utcEndOfDay('2026-03-01');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['revenue', mockGetRevenueSeries],
    ['commissions', mockGetCommissionsSeries],
    ['avg-rating', mockGetAvgRatingSeries],
  ] as const)(
    'fills gaps with "0.00" (string) for monetary/average metric "%s"',
    async (metric, mockFn) => {
      mockFn.mockResolvedValueOnce([]);

      const result = await getAnalyticsSeries(metric as Parameters<typeof getAnalyticsSeries>[0], from, to, 'day');

      expect(result.series.length).toBeGreaterThan(0);
      for (const point of result.series) {
        expect(typeof point.value).toBe('string');
        expect(point.value).toBe('0.00');
      }
    }
  );

  it.each([
    ['transactions', mockGetTransactionsSeries],
    ['registrations', mockGetRegistrationsSeries],
    ['stations', mockGetStationsSeries],
    ['reservations', mockGetReservationsSeries],
    ['cancellations', mockGetCancellationsSeries],
    ['support-tickets', mockGetSupportTicketsSeries],
  ] as const)(
    'fills gaps with 0 (number) for count metric "%s"',
    async (metric, mockFn) => {
      mockFn.mockResolvedValueOnce([]);

      const result = await getAnalyticsSeries(metric as Parameters<typeof getAnalyticsSeries>[0], from, to, 'day');

      expect(result.series.length).toBeGreaterThan(0);
      for (const point of result.series) {
        expect(typeof point.value).toBe('number');
        expect(point.value).toBe(0);
      }
    }
  );
});
