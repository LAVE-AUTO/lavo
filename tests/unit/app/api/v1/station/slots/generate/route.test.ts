/**
 * API tests for POST /api/v1/station/slots/generate.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockGenerateAndPersistSlots = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/station/slot-service', () => ({
  generateAndPersistSlots: (...args: unknown[]) => mockGenerateAndPersistSlots(...args),
}));

import { POST } from '@/app/api/v1/station/slots/generate/route';

const auth = { sub: 'user-id', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const slotId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('POST /api/v1/station/slots/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockGenerateAndPersistSlots.mockResolvedValue([
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

  it('returns 201 with generated slots (date only)', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-03-07' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0].id).toBe(slotId);
    expect(mockGenerateAndPersistSlots).toHaveBeenCalledWith(
      stationId,
      '2026-03-07',
      undefined,
      undefined
    );
  });

  it('returns 201 with date and end_date', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-03-07', end_date: '2026-03-10' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockGenerateAndPersistSlots).toHaveBeenCalledWith(
      stationId,
      '2026-03-07',
      '2026-03-10',
      undefined
    );
  });

  it('returns 201 with date and interval_minutes', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-03-07', interval_minutes: 60 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    expect(mockGenerateAndPersistSlots).toHaveBeenCalledWith(
      stationId,
      '2026-03-07',
      undefined,
      60
    );
  });

  it('returns 400 for invalid body (missing date)', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockGenerateAndPersistSlots).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid date format', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '03-07-2026' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockGenerateAndPersistSlots).not.toHaveBeenCalled();
  });

  it('returns 400 for end_date before date', async () => {
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-03-10', end_date: '2026-03-07' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockGenerateAndPersistSlots).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-03-07' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockGenerateAndPersistSlots).not.toHaveBeenCalled();
  });

  it('returns 404 when no station for user', async () => {
    mockFindStationByUserId.mockResolvedValueOnce(undefined);
    const req = new Request('http://localhost/api/v1/station/slots/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-03-07' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
    expect(mockGenerateAndPersistSlots).not.toHaveBeenCalled();
  });
});
