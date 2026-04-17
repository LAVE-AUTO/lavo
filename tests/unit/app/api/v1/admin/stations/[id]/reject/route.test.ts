/**
 * API tests for POST /api/v1/admin/stations/:id/reject.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockRejectStation = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/station/station-service', () => ({
  rejectStation: (...args: unknown[]) => mockRejectStation(...args),
}));

import { POST } from '@/app/api/v1/admin/stations/[id]/reject/route';
import { NotFoundError, ForbiddenError } from '@/lib/errors';

const adminAuth = { sub: 'admin-1', role: 'admin' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const validReason = 'Documents do not meet the required standards.';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makeRequest(id: string, body?: unknown): Request {
  return new Request(`http://localhost/api/v1/admin/stations/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/v1/admin/stations/:id/reject', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockRejectStation.mockResolvedValue(undefined);
  });

  it('returns 200 and rejects the station for a valid request', async () => {
    const res = await POST(
      makeRequest(stationId, { rejection_reason: validReason }),
      { params: buildParams(stationId) }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ rejected: true });
    expect(mockRejectStation).toHaveBeenCalledWith('admin-1', stationId, validReason);
  });

  it('returns 400 when station id is not a valid UUID', async () => {
    const res = await POST(
      makeRequest('not-a-uuid', { rejection_reason: validReason }),
      { params: buildParams('not-a-uuid') }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRejectStation).not.toHaveBeenCalled();
  });

  it('returns 400 when rejection_reason is missing', async () => {
    const res = await POST(
      makeRequest(stationId, {}),
      { params: buildParams(stationId) }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRejectStation).not.toHaveBeenCalled();
  });

  it('returns 400 when rejection_reason is too short', async () => {
    const res = await POST(
      makeRequest(stationId, { rejection_reason: 'short' }),
      { params: buildParams(stationId) }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRejectStation).not.toHaveBeenCalled();
  });

  it('returns 400 on invalid JSON body', async () => {
    const req = new Request(`http://localhost/api/v1/admin/stations/${stationId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });

    const res = await POST(req, { params: buildParams(stationId) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockRejectStation).not.toHaveBeenCalled();
  });

  it('returns auth response when requireRole fails', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

    const res = await POST(
      makeRequest(stationId, { rejection_reason: validReason }),
      { params: buildParams(stationId) }
    );

    expect(res.status).toBe(401);
    expect(mockRejectStation).not.toHaveBeenCalled();
  });

  it('returns 404 when station is not found', async () => {
    mockRejectStation.mockRejectedValueOnce(new NotFoundError('Station not found'));

    const res = await POST(
      makeRequest(stationId, { rejection_reason: validReason }),
      { params: buildParams(stationId) }
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe('Station not found');
  });

  it('returns 403 when station is not in pending state', async () => {
    mockRejectStation.mockRejectedValueOnce(new ForbiddenError('Station is not pending validation'));

    const res = await POST(
      makeRequest(stationId, { rejection_reason: validReason }),
      { params: buildParams(stationId) }
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.message).toBe('Station is not pending validation');
  });

  it('returns 500 on unexpected error', async () => {
    mockRejectStation.mockRejectedValueOnce(new Error('db crash'));

    const res = await POST(
      makeRequest(stationId, { rejection_reason: validReason }),
      { params: buildParams(stationId) }
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
