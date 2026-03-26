/**
 * Unit tests for GET /api/v1/admin/analytics/[metric].
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetAnalyticsSeries = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/admin/analytics-service', () => ({
  getAnalyticsSeries: (...args: unknown[]) => mockGetAnalyticsSeries(...args),
}));

import { GET } from '@/app/api/v1/admin/analytics/[metric]/route';
import { AppError } from '@/lib/errors';
import { VALID_METRICS } from '@/validators/analytics';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };

function makeSeriesFixture(metric: string) {
  return {
    metric,
    group_by: 'day',
    period: { from: '2026-01-01', to: '2026-03-26' },
    series: [
      { date: '2026-01-01', value: 5 },
      { date: '2026-01-02', value: 3 },
    ],
  };
}

function makeGetRequest(metric: string, queryString = ''): Request {
  const url = `http://localhost/api/v1/admin/analytics/${metric}${queryString ? `?${queryString}` : ''}`;
  return new Request(url);
}

function buildParams(metric: string): Promise<{ metric: string }> {
  return Promise.resolve({ metric });
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/analytics/[metric]
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/analytics/[metric]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
  });

  // --- Happy path: all 9 valid metrics with explicit date range ---

  it.each(VALID_METRICS)(
    'returns 200 for metric "%s" with ?from=2026-01-01&to=2026-03-26&group_by=day',
    async (metric) => {
      mockGetAnalyticsSeries.mockResolvedValueOnce(makeSeriesFixture(metric));

      const res = await GET(
        makeGetRequest(metric, 'from=2026-01-01&to=2026-03-26&group_by=day'),
        { params: buildParams(metric) }
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.metric).toBe(metric);
      expect(body.data.series).toBeDefined();
      expect(Array.isArray(body.data.series)).toBe(true);
    }
  );

  // --- Happy path: group_by variants ---

  it('returns 200 when group_by=week is provided', async () => {
    mockGetAnalyticsSeries.mockResolvedValueOnce({
      ...makeSeriesFixture('transactions'),
      group_by: 'week',
    });

    const res = await GET(
      makeGetRequest('transactions', 'from=2026-01-01&to=2026-03-26&group_by=week'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(200);
    expect(mockGetAnalyticsSeries).toHaveBeenCalledWith(
      'transactions',
      expect.any(Date),
      expect.any(Date),
      'week'
    );
  });

  it('returns 200 when group_by=month is provided', async () => {
    mockGetAnalyticsSeries.mockResolvedValueOnce({
      ...makeSeriesFixture('revenue'),
      group_by: 'month',
    });

    const res = await GET(
      makeGetRequest('revenue', 'from=2026-01-01&to=2026-03-26&group_by=month'),
      { params: buildParams('revenue') }
    );

    expect(res.status).toBe(200);
    expect(mockGetAnalyticsSeries).toHaveBeenCalledWith(
      'revenue',
      expect.any(Date),
      expect.any(Date),
      'month'
    );
  });

  // --- Happy path: default params (no query string) ---

  it('returns 200 with defaults when no query params are provided', async () => {
    mockGetAnalyticsSeries.mockResolvedValueOnce(makeSeriesFixture('transactions'));

    const res = await GET(
      makeGetRequest('transactions'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(200);
    expect(mockGetAnalyticsSeries).toHaveBeenCalledWith(
      'transactions',
      expect.any(Date),
      expect.any(Date),
      'day' // default group_by
    );
  });

  // --- Cache-Control header ---

  it('sets Cache-Control: max-age=60 on a 200 response', async () => {
    mockGetAnalyticsSeries.mockResolvedValueOnce(makeSeriesFixture('transactions'));

    const res = await GET(
      makeGetRequest('transactions'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=60');
  });

  it('sets Cache-Control: private on a 200 response (auth-gated data must not be shared-cached)', async () => {
    mockGetAnalyticsSeries.mockResolvedValueOnce(makeSeriesFixture('transactions'));

    const res = await GET(
      makeGetRequest('transactions'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('private');
  });

  // --- Validation: from/to 365-day max span ---

  it('returns 400 when from/to range exceeds 365 days', async () => {
    // 2025-01-01 to 2026-02-01 is 396 days — over the limit.
    const res = await GET(
      makeGetRequest('transactions', 'from=2025-01-01&to=2026-02-01'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  it('returns 200 when from/to range is exactly 365 days', async () => {
    // 2025-03-26 to 2026-03-26 is exactly 365 days.
    mockGetAnalyticsSeries.mockResolvedValueOnce(makeSeriesFixture('transactions'));

    const res = await GET(
      makeGetRequest('transactions', 'from=2025-03-26&to=2026-03-26'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(200);
    expect(mockGetAnalyticsSeries).toHaveBeenCalledTimes(1);
  });

  // --- Validation: unknown metric ---

  it('returns 400 for an unknown metric slug', async () => {
    const res = await GET(
      makeGetRequest('foo'),
      { params: buildParams('foo') }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  it('returns 400 for an empty string metric', async () => {
    const res = await GET(
      makeGetRequest(''),
      { params: buildParams('') }
    );

    expect(res.status).toBe(400);
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  // --- Validation: from/to cross-field rules ---

  it('returns 400 when from is provided without to', async () => {
    const res = await GET(
      makeGetRequest('transactions', 'from=2026-01-01'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  it('returns 400 when to is provided without from', async () => {
    const res = await GET(
      makeGetRequest('transactions', 'to=2026-03-26'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  it('returns 400 when from is after to', async () => {
    const res = await GET(
      makeGetRequest('transactions', 'from=2026-03-26&to=2026-01-01'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  // --- Validation: group_by ---

  it('returns 400 when group_by has an invalid value', async () => {
    const res = await GET(
      makeGetRequest('transactions', 'from=2026-01-01&to=2026-03-26&group_by=invalid'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  // --- Auth guards ---

  it('returns 401 when requireRole returns a 401 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await GET(
      makeGetRequest('transactions'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(401);
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  it('returns 403 when requireRole returns a 403 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await GET(
      makeGetRequest('transactions'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(403);
    expect(mockGetAnalyticsSeries).not.toHaveBeenCalled();
  });

  // --- Service error handling ---

  it('maps AppError from service to a controlled response', async () => {
    mockGetAnalyticsSeries.mockRejectedValueOnce(new AppError('Service unavailable', 503));

    const res = await GET(
      makeGetRequest('transactions'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe('Service unavailable');
  });

  it('returns 500 on unexpected non-AppError exception from the service', async () => {
    mockGetAnalyticsSeries.mockRejectedValueOnce(new Error('DB connection failure'));

    const res = await GET(
      makeGetRequest('transactions'),
      { params: buildParams('transactions') }
    );

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
