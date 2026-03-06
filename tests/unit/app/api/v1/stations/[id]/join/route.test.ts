/**
 * API tests for POST /api/v1/stations/:id/join (client en route - maps URL).
 * @jest-environment node
 */
const mockGetStationJoinPublic = jest.fn();

jest.mock('@/server/station/station-service', () => ({
  getStationJoinPublic: (...args: unknown[]) =>
    mockGetStationJoinPublic(...args),
}));

import { POST } from '@/app/api/v1/stations/[id]/join/route';
import { NotFoundError } from '@/lib/errors';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe('POST /api/v1/stations/:id/join', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 and mapsUrl when station active', async () => {
    const mapsUrl = 'https://www.google.com/maps?q=48.86,2.35';
    mockGetStationJoinPublic.mockResolvedValueOnce({ mapsUrl });
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const req = new Request('http://localhost/api/v1/stations/1/join', {
      method: 'POST',
    });
    const res = await POST(req, { params: buildParams(uuid) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.mapsUrl).toBe(mapsUrl);
    expect(mockGetStationJoinPublic).toHaveBeenCalledWith(uuid);
  });

  it('returns 400 for invalid uuid', async () => {
    const req = new Request('http://localhost/api/v1/stations/1/join', {
      method: 'POST',
    });
    const res = await POST(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetStationJoinPublic).not.toHaveBeenCalled();
  });

  it('returns 404 when station not found or inactive', async () => {
    mockGetStationJoinPublic.mockRejectedValueOnce(
      new NotFoundError('Station not found')
    );
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    const req = new Request('http://localhost/api/v1/stations/1/join', {
      method: 'POST',
    });
    const res = await POST(req, { params: buildParams(uuid) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Station not found');
    expect(mockGetStationJoinPublic).toHaveBeenCalledWith(uuid);
  });
});
