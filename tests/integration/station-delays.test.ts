/**
 * Integration tests for GET /api/v1/station/delays.
 *
 * Tests the full handler → service chain for listing delay requests:
 *   - Paginated response shape
 *   - Status filter (pending | accepted | refused | all)
 *   - Station lookup from authenticated user
 *   - Unauthenticated access rejected (401)
 *
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockListDelaysByStation = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));

jest.mock('@/server/reservations/delay-service', () => ({
  listDelaysByStation: (...args: unknown[]) => mockListDelaysByStation(...args),
}));

import { GET } from '@/app/api/v1/station/delays/route';
import { NotFoundError, AppError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const STATION_AUTH = { sub: 'station-user-uuid-0001', role: 'station', force_password_change: false };

const STATION = {
  id: 'station-uuid-0001',
  user_id: STATION_AUTH.sub,
  name: 'Hurryline Express Douala',
  status: 'active',
};

function makeDelayRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'delay-uuid-0001',
    reservation_id: 'reservation-uuid-0001',
    user_id: 'client-uuid-0001',
    station_id: STATION.id,
    status: 'pending',
    message: 'Running 10 minutes late',
    refusal_reason: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    reservation: {
      id: 'reservation-uuid-0001',
      scheduled_at: new Date().toISOString(),
      vehicle_format_id: 'format-uuid-0001',
    },
    ...overrides,
  };
}

function makeListResult(rows: ReturnType<typeof makeDelayRow>[] = [], total = 1) {
  return {
    rows,
    total,
    page: 1,
    perPage: 20,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(queryString = ''): Request {
  const url = `http://localhost/api/v1/station/delays${queryString ? `?${queryString}` : ''}`;
  return new Request(url, { method: 'GET' });
}

// ---------------------------------------------------------------------------
// GET /api/v1/station/delays
// ---------------------------------------------------------------------------

describe('GET /api/v1/station/delays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(STATION_AUTH);
    mockFindStationByUserId.mockResolvedValue(STATION);
    mockListDelaysByStation.mockResolvedValue(makeListResult([makeDelayRow()]));
  });

  // --- Happy path ---

  it('returns 200 with paginated delay items on success', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.meta).toMatchObject({
      total: 1,
      page: 1,
      per_page: 20,
    });
  });

  it('returns the expected delay item shape', async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    const item = body.data.items[0];
    expect(item).toMatchObject({
      id: 'delay-uuid-0001',
      reservation_id: 'reservation-uuid-0001',
      user_id: 'client-uuid-0001',
      station_id: STATION.id,
      status: 'pending',
      message: 'Running 10 minutes late',
      refusal_reason: null,
    });
    expect(item.reservation).toMatchObject({
      id: 'reservation-uuid-0001',
      vehicle_format_id: 'format-uuid-0001',
    });
  });

  it('returns reservation as null when not populated', async () => {
    mockListDelaysByStation.mockResolvedValue(
      makeListResult([makeDelayRow({ reservation: null })])
    );

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items[0].reservation).toBeNull();
  });

  it('returns empty items array when there are no delays', async () => {
    mockListDelaysByStation.mockResolvedValue(makeListResult([], 0));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(0);
    expect(body.data.meta.total).toBe(0);
  });

  // --- Status filter ---

  it.each(['pending', 'accepted', 'refused', 'all'] as const)(
    'passes status=%s to the service when provided as query param',
    async (status) => {
      mockListDelaysByStation.mockResolvedValue(makeListResult([]));

      await GET(makeGetRequest(`status=${status}`));

      expect(mockListDelaysByStation).toHaveBeenCalledWith(
        STATION.id,
        expect.objectContaining({ status })
      );
    }
  );

  it('defaults to status=all when no status query param is given', async () => {
    await GET(makeGetRequest());

    expect(mockListDelaysByStation).toHaveBeenCalledWith(
      STATION.id,
      expect.objectContaining({ status: 'all' })
    );
  });

  // --- Pagination ---

  it('passes page and per_page to the service from query params', async () => {
    await GET(makeGetRequest('page=2&per_page=10'));

    expect(mockListDelaysByStation).toHaveBeenCalledWith(
      STATION.id,
      expect.objectContaining({ page: 2, perPage: 10 })
    );
  });

  it('returns 400 when per_page exceeds the maximum of 100', async () => {
    const res = await GET(makeGetRequest('per_page=101'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockListDelaysByStation).not.toHaveBeenCalled();
  });

  it('returns 400 when status is an unknown value', async () => {
    const res = await GET(makeGetRequest('status=unknown_status'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockListDelaysByStation).not.toHaveBeenCalled();
  });

  // --- Auth: unauthenticated ---

  it('returns 401 when no authentication is provided', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized', code: 'UNAUTHORIZED' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(401);
    expect(mockListDelaysByStation).not.toHaveBeenCalled();
  });

  it('returns 403 when the authenticated user is not a station', async () => {
    mockRequireRole.mockResolvedValue(
      new Response(JSON.stringify({ message: 'Forbidden', code: 'FORBIDDEN' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const res = await GET(makeGetRequest());
    expect(res.status).toBe(403);
    expect(mockListDelaysByStation).not.toHaveBeenCalled();
  });

  // --- Station not found ---

  it('returns 404 when no station is associated with the authenticated user', async () => {
    mockFindStationByUserId.mockResolvedValue(undefined);

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(mockListDelaysByStation).not.toHaveBeenCalled();
  });

  // --- Service errors ---

  it('returns 404 when the service raises NotFoundError', async () => {
    mockListDelaysByStation.mockRejectedValue(new NotFoundError('Station not found'));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
  });

  it('returns 500 on unexpected service failure', async () => {
    mockListDelaysByStation.mockRejectedValue(new Error('Query timeout'));

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
