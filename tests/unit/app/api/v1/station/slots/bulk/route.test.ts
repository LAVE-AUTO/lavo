/**
 * API tests for POST /api/v1/station/slots/bulk.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockCreateSlotsBulk = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/station/slot-service', () => ({
  createSlotsBulk: (...args: unknown[]) => mockCreateSlotsBulk(...args),
}));

import { POST } from '@/app/api/v1/station/slots/bulk/route';

const auth = { sub: 'user-id', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const slotId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('POST /api/v1/station/slots/bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockCreateSlotsBulk.mockResolvedValue([
      {
        id: slotId,
        station_id: stationId,
        start_time: new Date('2026-03-07T08:00:00.000Z'),
        end_time: new Date('2026-03-07T08:30:00.000Z'),
        capacity: 2,
        booked_count: 0,
        status: 'available',
      },
    ]);
  });

  it('returns 201 with created slots', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: [
          {
            start_time: '2026-03-07T08:00:00.000Z',
            end_time: '2026-03-07T08:30:00.000Z',
            capacity: 2,
          },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].id).toBe(slotId);
    expect(mockCreateSlotsBulk).toHaveBeenCalledWith(
      stationId,
      expect.arrayContaining([
        expect.objectContaining({
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          capacity: 2,
        }),
      ])
    );
  });

  it('returns 400 for invalid body (empty slots)', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slots: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCreateSlotsBulk).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid slot (capacity 0)', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: [
          {
            start_time: '2026-03-07T08:00:00.000Z',
            end_time: '2026-03-07T08:30:00.000Z',
            capacity: 0,
          },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockCreateSlotsBulk).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const req = new Request('http://localhost/api/v1/station/slots/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: [
          {
            start_time: '2026-03-07T08:00:00.000Z',
            end_time: '2026-03-07T08:30:00.000Z',
            capacity: 1,
          },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockCreateSlotsBulk).not.toHaveBeenCalled();
  });

  it('returns 404 when no station for user', async () => {
    mockFindStationByUserId.mockResolvedValueOnce(undefined);
    const req = new Request('http://localhost/api/v1/station/slots/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slots: [
          {
            start_time: '2026-03-07T08:00:00.000Z',
            end_time: '2026-03-07T08:30:00.000Z',
            capacity: 1,
          },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(mockCreateSlotsBulk).not.toHaveBeenCalled();
  });
});
