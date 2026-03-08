/**
 * API tests for GET /api/v1/station/entries.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockListEntriesByStation = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  listEntriesByStation: (...args: unknown[]) => mockListEntriesByStation(...args),
}));

import { GET } from '@/app/api/v1/station/entries/route';

const stationAuth = { sub: 'station-user-1', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('GET /api/v1/station/entries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(stationAuth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockListEntriesByStation.mockResolvedValue([
      {
        id: 'entry-1',
        user_id: 'user-1',
        entry_type: 'reservation',
        time_slot_id: 'slot-1',
        station_id: stationId,
        vehicle_format_id: 'format-1',
        status: 'pending',
        queue_position: null,
        amount_paid: '12.00',
        created_at: new Date(),
        updated_at: new Date(),
        completed_at: null,
      },
    ]);
  });

  it('returns 200 with entries when authenticated as station', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0].entry_type).toBe('reservation');
    expect(mockListEntriesByStation).toHaveBeenCalledWith(stationId);
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockListEntriesByStation).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not station', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockListEntriesByStation).not.toHaveBeenCalled();
  });

  it('returns 404 when no station associated with account', async () => {
    mockFindStationByUserId.mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toMatch(/no station associated/i);
    expect(mockListEntriesByStation).not.toHaveBeenCalled();
  });
});
