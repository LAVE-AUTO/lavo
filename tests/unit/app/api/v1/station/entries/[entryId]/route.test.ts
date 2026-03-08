/**
 * API tests for PATCH /api/v1/station/entries/:entryId.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockSetEntryStatusByStation = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/reservations/reservation-service', () => ({
  setEntryStatusByStation: (...args: unknown[]) => mockSetEntryStatusByStation(...args),
}));

import { PATCH } from '@/app/api/v1/station/entries/[entryId]/route';
import { NotFoundError } from '@/lib/errors';

const stationAuth = { sub: 'station-user-1', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const entryId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

function buildParams(id: string): Promise<{ entryId: string }> {
  return Promise.resolve({ entryId: id });
}

describe('PATCH /api/v1/station/entries/:entryId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(stationAuth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockSetEntryStatusByStation.mockResolvedValue({
      id: entryId,
      entry_type: 'reservation',
      time_slot_id: 'slot-1',
      station_id: stationId,
      vehicle_format_id: 'format-1',
      status: 'completed',
      queue_position: null,
      amount_paid: '12.00',
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  it('returns 200 with updated entry when valid body and entry belongs to station', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.status).toBe('completed');
    expect(mockSetEntryStatusByStation).toHaveBeenCalledWith(entryId, stationId, 'completed');
  });

  it('returns 400 for invalid entryId (non-UUID)', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
    const res = await PATCH(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSetEntryStatusByStation).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(400);
    expect(mockSetEntryStatusByStation).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid status value', async () => {
    const req = new Request('http://localhost/api/v1/station/entries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'pending' }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSetEntryStatusByStation).not.toHaveBeenCalled();
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/station/entries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(401);
    expect(mockSetEntryStatusByStation).not.toHaveBeenCalled();
  });

  it('returns 404 when no station associated with account', async () => {
    mockFindStationByUserId.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/v1/station/entries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
    expect(mockSetEntryStatusByStation).not.toHaveBeenCalled();
  });

  it('returns 404 when entry not found or does not belong to this station', async () => {
    mockSetEntryStatusByStation.mockRejectedValueOnce(new NotFoundError('Entry not found'));
    const req = new Request('http://localhost/api/v1/station/entries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    const res = await PATCH(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Entry not found');
  });
});
