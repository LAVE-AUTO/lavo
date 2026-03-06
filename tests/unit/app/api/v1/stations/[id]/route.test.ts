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
    };
    mockGetStationDetailPublic.mockResolvedValueOnce(station);
    const req = new Request('http://localhost/api/v1/stations/1');
    const res = await GET(req, { params: buildParams(station.id) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(station);
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
