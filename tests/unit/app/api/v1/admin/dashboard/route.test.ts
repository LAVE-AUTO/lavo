/**
 * Unit tests for GET /api/v1/admin/dashboard.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetDashboardData = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/admin/dashboard-service', () => ({
  getDashboardData: (...args: unknown[]) => mockGetDashboardData(...args),
}));

import { GET } from '@/app/api/v1/admin/dashboard/route';
import { AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const adminAuth = { sub: 'admin-uuid-0001', role: 'admin' };

const dashboardFixture = {
  period: { from: '2026-01-01', to: '2026-03-26', days: 84 },
  totals: {
    active_stations: 10,
    total_clients: 250,
    pending_kyc: 3,
    open_support_tickets: 5,
  },
  metrics: {
    total_transactions: 42,
    total_revenue: '1200.00',
    total_commissions: '120.00',
  },
  alerts: {
    pending_kyc: [],
    open_support_tickets: [],
  },
};

function makeGetRequest(queryString = ''): Request {
  const url = `http://localhost/api/v1/admin/dashboard${queryString ? `?${queryString}` : ''}`;
  return new Request(url);
}

// ---------------------------------------------------------------------------
// GET /api/v1/admin/dashboard
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockGetDashboardData.mockResolvedValue(dashboardFixture);
  });

  // --- Happy path: valid query combinations ---

  it('returns 200 with dashboard data when ?period=30 is provided', async () => {
    const res = await GET(makeGetRequest('period=30'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(body.data.totals).toBeDefined();
    expect(body.data.metrics).toBeDefined();
    expect(body.data.alerts).toBeDefined();
    expect(mockGetDashboardData).toHaveBeenCalledTimes(1);
    // period=30 → days=30 passed to service
    const [from, to, days] = mockGetDashboardData.mock.calls[0];
    expect(days).toBe(30);
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);
  });

  it('returns 200 with dashboard data when ?from=2026-01-01&to=2026-03-26 is provided', async () => {
    const res = await GET(makeGetRequest('from=2026-01-01&to=2026-03-26'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(mockGetDashboardData).toHaveBeenCalledTimes(1);
    const [from, to] = mockGetDashboardData.mock.calls[0];
    expect(from).toBeInstanceOf(Date);
    expect(to).toBeInstanceOf(Date);
    // from must be 2026-01-01
    expect(from.toISOString()).toMatch(/^2026-01-01/);
  });

  it('returns 200 with dashboard data when no params are provided (default 30-day window)', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeDefined();
    expect(mockGetDashboardData).toHaveBeenCalledTimes(1);
    // default window is 30 days
    const [, , days] = mockGetDashboardData.mock.calls[0];
    expect(days).toBe(30);
  });

  // --- Cache-Control header on 200 responses ---

  it('sets Cache-Control: max-age=60 on a 200 response', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('max-age=60');
  });

  it('sets Cache-Control: private on a 200 response (auth-gated data must not be shared-cached)', async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('private');
  });

  // --- Validation: period ---

  it('returns 400 when period=0 (below minimum of 1)', async () => {
    const res = await GET(makeGetRequest('period=0'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  it('returns 400 when period=366 (above maximum of 365)', async () => {
    const res = await GET(makeGetRequest('period=366'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  // --- Validation: from/to 365-day max span ---

  it('returns 400 when from/to range exceeds 365 days', async () => {
    // 2025-01-01 to 2026-02-01 is 396 days — over the limit.
    const res = await GET(makeGetRequest('from=2025-01-01&to=2026-02-01'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  it('returns 200 when from/to range is exactly 365 days', async () => {
    // 2025-03-26 to 2026-03-26 is exactly 365 days.
    const res = await GET(makeGetRequest('from=2025-03-26&to=2026-03-26'));

    expect(res.status).toBe(200);
    expect(mockGetDashboardData).toHaveBeenCalledTimes(1);
  });

  // --- Validation: from/to cross-field rules ---

  it('returns 400 when from is provided without to', async () => {
    const res = await GET(makeGetRequest('from=2026-01-01'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  it('returns 400 when to is provided without from', async () => {
    const res = await GET(makeGetRequest('to=2026-03-26'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  it('returns 400 when from is after to', async () => {
    const res = await GET(makeGetRequest('from=2026-03-26&to=2026-01-01'));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  // --- Auth guards ---

  it('returns 401 when requireRole returns a 401 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(401);
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  it('returns 403 when requireRole returns a 403 Response', async () => {
    mockRequireRole.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
    );

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(403);
    expect(mockGetDashboardData).not.toHaveBeenCalled();
  });

  // --- Service error handling ---

  it('maps AppError from service to a controlled response', async () => {
    mockGetDashboardData.mockRejectedValueOnce(new AppError('Service unavailable', 503));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.message).toBe('Service unavailable');
  });

  it('returns 500 on unexpected non-AppError exception from the service', async () => {
    mockGetDashboardData.mockRejectedValueOnce(new Error('DB connection failure'));

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
