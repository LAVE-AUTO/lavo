/**
 * API tests for GET /api/v1/admin/stations/:id.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetStationById = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/station/station-service', () => ({
  getStationById: (...args: unknown[]) => mockGetStationById(...args),
}));

import { GET } from '@/app/api/v1/admin/stations/[id]/route';
import { NotFoundError } from '@/lib/errors';

const adminAuth = { sub: 'admin-1', role: 'admin' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makeRequest(id: string): Request {
  return new Request(`http://localhost/api/v1/admin/stations/${id}`);
}

describe('GET /api/v1/admin/stations/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockGetStationById.mockResolvedValue({ id: stationId, name: 'Test Station', documents: [] });
  });

  it('returns 200 with station data for a valid UUID', async () => {
    const res = await GET(makeRequest(stationId), { params: buildParams(stationId) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe(stationId);
    expect(mockGetStationById).toHaveBeenCalledWith(stationId);
  });

  it('returns 400 when station id is not a valid UUID', async () => {
    const res = await GET(makeRequest('not-a-uuid'), { params: buildParams('not-a-uuid') });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetStationById).not.toHaveBeenCalled();
  });

  it('returns auth response when requireRole fails', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const res = await GET(makeRequest(stationId), { params: buildParams(stationId) });

    expect(res.status).toBe(401);
    expect(mockGetStationById).not.toHaveBeenCalled();
  });

  it('returns 404 when station is not found', async () => {
    mockGetStationById.mockRejectedValueOnce(new NotFoundError('Station not found'));

    const res = await GET(makeRequest(stationId), { params: buildParams(stationId) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe('Station not found');
  });

  it('returns 500 on unexpected error', async () => {
    mockGetStationById.mockRejectedValueOnce(new Error('db crash'));

    const res = await GET(makeRequest(stationId), { params: buildParams(stationId) });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
