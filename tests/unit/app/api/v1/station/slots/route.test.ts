/**
 * API tests for POST and DELETE /api/v1/station/slots.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockCreateSlot = jest.fn();
const mockDeleteSlot = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/station/slot-service', () => ({
  createSlot: (...args: unknown[]) => mockCreateSlot(...args),
  deleteSlot: (...args: unknown[]) => mockDeleteSlot(...args),
}));

import { POST, DELETE } from '@/app/api/v1/station/slots/route';
import { ConflictError } from '@/lib/errors';

const auth = { sub: 'user-id', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const slotId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('POST /api/v1/station/slots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockCreateSlot.mockResolvedValue({
      id: slotId,
      station_id: stationId,
      start_time: new Date('2026-03-07T08:00:00.000Z'),
      end_time: new Date('2026-03-07T08:30:00.000Z'),
      capacity: 2,
      booked_count: 0,
      status: 'available',
    });
  });

  it('returns 201 with created slot', async () => {
    const req = new Request('http://localhost/api/v1/station/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_time: '2026-03-07T08:00:00.000Z',
        end_time: '2026-03-07T08:30:00.000Z',
        capacity: 2,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.id).toBe(slotId);
    expect(data.data.capacity).toBe(2);
    expect(mockCreateSlot).toHaveBeenCalledWith(
      stationId,
      expect.any(Date),
      expect.any(Date),
      2
    );
  });

  it('returns 400 for invalid body', async () => {
    const req = new Request('http://localhost/api/v1/station/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: '2026-03-07T08:00:00.000Z', end_time: '2026-03-07T08:30:00.000Z', capacity: 0 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/v1/station/slots', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockDeleteSlot.mockResolvedValue(undefined);
  });

  it('returns 200 with deleted and failed arrays', async () => {
    const req = new Request('http://localhost/api/v1/station/slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [slotId] }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.deleted).toContain(slotId);
    expect(mockDeleteSlot).toHaveBeenCalledWith(stationId, slotId);
  });

  it('returns 400 for invalid body', async () => {
    const req = new Request('http://localhost/api/v1/station/slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with failed array when one slot has reservations', async () => {
    const otherId = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
    mockDeleteSlot
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ConflictError('Cannot delete slot that has reservations'));
    const req = new Request('http://localhost/api/v1/station/slots', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [slotId, otherId] }),
    });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.data.deleted).toContain(slotId);
    expect(data.data.failed).toHaveLength(1);
    expect(data.data.failed[0].id).toBe(otherId);
    expect(data.data.failed[0].reason).toContain('reservations');
  });
});
