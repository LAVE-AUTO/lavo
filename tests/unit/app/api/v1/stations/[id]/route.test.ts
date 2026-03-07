/**
 * API tests for GET /api/v1/stations/:id (station detail).
 * @jest-environment node
 */
const mockGetStationDetailPublic = jest.fn();

jest.mock('@/server/station/station-service', () => ({
  getStationDetailPublic: (...args: unknown[]) =>
    mockGetStationDetailPublic(...args),
}));

import { GET } from '@/app/api/v1/stations/[id]/route';
import { NotFoundError } from '@/lib/errors';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('GET /api/v1/stations/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 and station when found and active', async () => {
    const station = {
      id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      name: 'Station A',
      status: 'active',
      stationConfig: null,
      vehicleFormats: [],
      timeSlots: [],
      available_slots: 1,
      available: true,
    };
    mockGetStationDetailPublic.mockResolvedValueOnce(station);
    const req = new Request('http://localhost/api/v1/stations/1');
    const res = await GET(req, { params: buildParams(station.id) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(station);
    expect(body.data.available_slots).toBe(1);
    expect(body.data.available).toBe(true);
    expect(mockGetStationDetailPublic).toHaveBeenCalledWith(station.id);
  });

  it('returns 400 for invalid uuid', async () => {
    const req = new Request('http://localhost/api/v1/stations/1');
    const res = await GET(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetStationDetailPublic).not.toHaveBeenCalled();
  });

  it('detail response contains available and available_slots; when no future slots available_slots is 0 and available is false', async () => {
    const station = {
      id: 'b2c3d4e5-f6a7-8901-bcde-f23456789012',
      name: 'Station B',
      status: 'active',
      stationConfig: null,
      vehicleFormats: [],
      timeSlots: [],
      available_slots: 0,
      available: false,
    };
    mockGetStationDetailPublic.mockResolvedValueOnce(station);
    const req = new Request('http://localhost/api/v1/stations/1');
    const res = await GET(req, { params: buildParams(station.id) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.available_slots).toBe(0);
    expect(body.data.available).toBe(false);
    expect(body.data.id).toBe(station.id);
  });

  it('returns 404 when station not found or inactive', async () => {
    mockGetStationDetailPublic.mockRejectedValueOnce(
      new NotFoundError('Station not found')
    );
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const req = new Request('http://localhost/api/v1/stations/1');
    const res = await GET(req, { params: buildParams(uuid) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Station not found');
    expect(mockGetStationDetailPublic).toHaveBeenCalledWith(uuid);
  });
});
