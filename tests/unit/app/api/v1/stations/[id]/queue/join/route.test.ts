/**
 * API tests for POST /api/v1/stations/:id/queue/join.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationById = jest.fn();
const mockJoinQueue = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
}));
jest.mock('@/server/reservations/queue-service', () => ({
  joinQueue: (...args: unknown[]) => mockJoinQueue(...args),
}));

import { POST } from '@/app/api/v1/stations/[id]/queue/join/route';
import { NotFoundError, ConflictError } from '@/lib/errors';

const userAuth = { sub: 'user-1', role: 'user' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const formatId = 'c3d4e5f6-a7b8-9012-cdef-234567890123';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('POST /api/v1/stations/:id/queue/join', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(userAuth);
    mockFindStationById.mockResolvedValue({
      id: stationId,
      status: 'active',
      is_open: true,
    });
    mockJoinQueue.mockResolvedValue({
      id: 'entry-1',
      entry_type: 'queue',
      time_slot_id: null,
      station_id: stationId,
      vehicle_format_id: formatId,
      status: 'pending',
      queue_position: 1,
      amount_paid: '15.00',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it('returns 201 with entry when valid body and station active', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.entry_type).toBe('queue');
    expect(data.data.queue_position).toBe(1);
    expect(mockJoinQueue).toHaveBeenCalledWith(userAuth.sub, stationId, formatId);
  });

  it('returns 400 for invalid station uuid', async () => {
    const req = new Request('http://localhost/api/v1/stations/x/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockJoinQueue).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(400);
    expect(mockJoinQueue).not.toHaveBeenCalled();
  });

  it('returns 400 for missing vehicle_format_id in body', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockJoinQueue).not.toHaveBeenCalled();
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/stations/1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(401);
    expect(mockJoinQueue).not.toHaveBeenCalled();
  });

  it('returns 404 when station not found or not active', async () => {
    mockFindStationById.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/v1/stations/1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    expect(mockJoinQueue).not.toHaveBeenCalled();
  });

  it('returns 404 when joinQueue throws NotFoundError', async () => {
    mockJoinQueue.mockRejectedValueOnce(new NotFoundError('Vehicle format not found'));
    const req = new Request('http://localhost/api/v1/stations/1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe('Vehicle format not found');
  });

  it('returns 409 when joinQueue throws ConflictError (e.g. duplicate join or format inactive)', async () => {
    mockJoinQueue.mockRejectedValueOnce(new ConflictError('Format is not active'));
    const req = new Request('http://localhost/api/v1/stations/1/queue/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_format_id: formatId }),
    });
    const res = await POST(req, { params: buildParams(stationId) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe('Format is not active');
    expect(body.code).toBe('CONFLICT');
  });
});
