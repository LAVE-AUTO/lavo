/**
 * API tests for GET and PATCH /api/v1/station/config.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationByUserId = jest.fn();
const mockGetOrCreateConfig = jest.fn();
const mockUpdateConfig = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationByUserId: (...args: unknown[]) => mockFindStationByUserId(...args),
}));
jest.mock('@/server/station/config-service', () => ({
  getOrCreateConfig: (...args: unknown[]) => mockGetOrCreateConfig(...args),
  updateConfig: (...args: unknown[]) => mockUpdateConfig(...args),
}));

import { GET, PATCH } from '@/app/api/v1/station/config/route';

const auth = { sub: 'user-id', role: 'station' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

describe('GET /api/v1/station/config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
  });

  it('returns 200 with config and posts', async () => {
    const config = { id: stationId, opening_time: '08:00', closing_time: '20:00' };
    const posts = [{ id: 'p1', station_id: stationId, position: 1, is_active: true }];
    mockGetOrCreateConfig.mockResolvedValue({ config, posts });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.config).toBeDefined();
    expect(body.data.posts).toHaveLength(1);
    expect(mockGetOrCreateConfig).toHaveBeenCalledWith(stationId);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockGetOrCreateConfig).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not STATION', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockGetOrCreateConfig).not.toHaveBeenCalled();
  });

  it('returns 404 when no station for user', async () => {
    mockFindStationByUserId.mockResolvedValueOnce(undefined);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(mockGetOrCreateConfig).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/station/config', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationByUserId.mockResolvedValue({ id: stationId });
    mockUpdateConfig.mockResolvedValue({
      config: { id: stationId },
      posts: [],
    });
  });

  it('returns 200 with updated config and posts', async () => {
    const req = new Request('http://localhost/api/v1/station/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ margin_before_minutes: 10 }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(mockUpdateConfig).toHaveBeenCalledWith(
      stationId,
      expect.objectContaining({ margin_before_minutes: 10 }),
      undefined
    );
  });

  it('returns 400 for invalid JSON', async () => {
    const req = new Request('http://localhost/api/v1/station/config', {
      method: 'PATCH',
      body: 'not json',
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for validation failure', async () => {
    const req = new Request('http://localhost/api/v1/station/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opening_time: '25:00' }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it('returns 403 when role is not STATION', async () => {
    mockRequireRole.mockResolvedValueOnce(new Response(null, { status: 403 }));
    const req = new Request('http://localhost/api/v1/station/config', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
    expect(mockUpdateConfig).not.toHaveBeenCalled();
  });
});
