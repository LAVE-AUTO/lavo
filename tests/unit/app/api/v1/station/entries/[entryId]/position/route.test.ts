/**
 * API tests for PATCH /api/v1/station/entries/:entryId/position.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockUpdateEntryPosition = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/reservations/queue-service', () => ({
  updateEntryPosition: (...args: unknown[]) => mockUpdateEntryPosition(...args),
}));

import { PATCH } from '@/app/api/v1/station/entries/[entryId]/position/route';
import { NotFoundError, ConflictError } from '@/lib/errors';

const stationAuth = { sub: 'station-user-1', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const entryId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

function buildParams(id: string): Promise<{ entryId: string }> {
  return Promise.resolve({ entryId: id });
}

describe('PATCH /api/v1/station/entries/:entryId/position', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(stationAuth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockUpdateEntryPosition.mockResolvedValue({
      id: entryId,
      entry_type: 'queue',
      queue_position: 2,
      station_id: stationId,
      vehicle_format_id: 'format-1',
      status: 'pending',
      amount_paid: '15.00',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it('returns 200 with updated entry when valid body and entry belongs to station', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_position: 2 }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.queue_position).toBe(2);
    expect(mockUpdateEntryPosition).toHaveBeenCalledWith(entryId, stationId, 2);
  });

  it('returns 400 for invalid entryId (non-UUID)', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_position: 1 }),
    });
    const res = await PATCH(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateEntryPosition).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(400);
    expect(mockUpdateEntryPosition).not.toHaveBeenCalled();
  });

  it('returns 400 for queue_position less than 1', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_position: 0 }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpdateEntryPosition).not.toHaveBeenCalled();
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_position: 1 }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(401);
    expect(mockUpdateEntryPosition).not.toHaveBeenCalled();
  });

  it('returns 404 when no station associated with account', async () => {
    mockFindStationByUserId.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_position: 1 }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
    expect(mockUpdateEntryPosition).not.toHaveBeenCalled();
  });

  it('returns 404 when entry not found or does not belong to this station', async () => {
    mockUpdateEntryPosition.mockRejectedValueOnce(
      new NotFoundError('Entry does not belong to this station')
    );
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_position: 1 }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Entry does not belong to this station');
  });

  it('returns 409 when entry is not a queue entry', async () => {
    mockUpdateEntryPosition.mockRejectedValueOnce(
      new ConflictError('Entry is not a queue entry')
    );
    const req = new Request('http://localhost/api/v1/station/entries/1/position', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_position: 1 }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe('Entry is not a queue entry');
    expect(body.code).toBe('CONFLICT');
  });
});
