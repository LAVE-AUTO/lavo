/**
 * API tests for GET /api/v1/stations (list active stations).
 * @jest-environment node
 */
const mockListStationsPublic = jest.fn();

jest.mock('@/server/station/station-service', () => ({
  listStationsPublic: (...args: unknown[]) => mockListStationsPublic(...args),
}));

import { GET } from '@/app/api/v1/stations/route';

function buildRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/v1/stations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with data.all and meta when query valid', async () => {
    const all = [
      { id: 'id1', name: 'Station One', status: 'active', available_slots: 2, available: true },
    ];
    mockListStationsPublic.mockResolvedValueOnce({
      data: { all },
      meta: { total: 1, page: 1, per_page: 20, total_pages: 1 },
    });
    const req = buildRequest(
      'http://localhost/api/v1/stations?q=Paris&city=Lyon&sort=name_asc'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.all).toEqual(all);
    expect(body.meta).toEqual({ total: 1, page: 1, per_page: 20, total_pages: 1 });
    expect(body.data.all[0].available_slots).toBe(2);
    expect(body.data.all[0].available).toBe(true);
    expect(mockListStationsPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Paris',
        city: 'Lyon',
        sort: ['name_asc'],
        page: 1,
        per_page: 20,
      })
    );
  });

  it('returns 200 with empty params; only data.all and meta (backward compatible)', async () => {
    mockListStationsPublic.mockResolvedValueOnce({
      data: { all: [] },
      meta: { total: 0, page: 1, per_page: 20, total_pages: 1 },
    });
    const req = buildRequest('http://localhost/api/v1/stations');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.all).toEqual([]);
    expect(body.meta).toBeDefined();
    expect(body.data.available_now).toBeUndefined();
    expect(mockListStationsPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        search: undefined,
        city: undefined,
        sort: undefined,
        page: 1,
        per_page: 20,
      })
    );
  });

  it('list response contains available and available_slots per item', async () => {
    const all = [
      { id: 'id1', name: 'Station One', status: 'active', available_slots: 2, available: true },
      { id: 'id2', name: 'Station Two', status: 'active', available_slots: 0, available: false },
    ];
    mockListStationsPublic.mockResolvedValueOnce({
      data: { all },
      meta: { total: 2, page: 1, per_page: 20, total_pages: 1 },
    });
    const req = buildRequest('http://localhost/api/v1/stations');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.all).toHaveLength(2);
    expect(body.data.all[0].available_slots).toBe(2);
    expect(body.data.all[0].available).toBe(true);
    expect(body.data.all[1].available_slots).toBe(0);
    expect(body.data.all[1].available).toBe(false);
  });

  it('passes groups, page, per_page, limit_per_group, format_id to service', async () => {
    mockListStationsPublic.mockResolvedValueOnce({
      data: { all: [], available_now: [], most_visited: [] },
      meta: { total: 0, page: 2, per_page: 10, total_pages: 1 },
    });
    const req = buildRequest(
      'http://localhost/api/v1/stations?groups=available_now,most_visited&page=2&per_page=10&limit_per_group=5&format_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockListStationsPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        groups: ['available_now', 'most_visited'],
        page: 2,
        per_page: 10,
        limit_per_group: 5,
        format_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
    );
  });

  it('returns 400 for invalid sort value', async () => {
    const req = buildRequest(
      'http://localhost/api/v1/stations?sort=invalid_sort'
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toBeDefined();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid format_id', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?format_id=not-a-uuid');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid groups value', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?groups=available_now,invalid_group');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for page less than 1', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?page=0');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for non-numeric page', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?page=abc');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for per_page over 100', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?per_page=101');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for limit_per_group over 100', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?groups=available_now&limit_per_group=101');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for page over 10000', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?page=10001');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid wash_type_ids (non-UUID in list)', async () => {
    const req = buildRequest(
      'http://localhost/api/v1/stations?wash_type_ids=a1b2c3d4-e5f6-7890-abcd-ef1234567890,not-a-uuid'
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid date', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?date=2024-02-30');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });

  it('returns 200 with data.most_appreciated when groups include most_appreciated', async () => {
    mockListStationsPublic.mockResolvedValueOnce({
      data: { all: [], available_now: [], most_appreciated: [{ id: 's1', name: 'Top' }], most_visited: [] },
      meta: { total: 0, page: 1, per_page: 20, total_pages: 1 },
    });
    const req = buildRequest('http://localhost/api/v1/stations?groups=most_appreciated');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.most_appreciated).toHaveLength(1);
    expect(body.data.most_appreciated[0].name).toBe('Top');
  });

  it('passes multi-criteria sort to service', async () => {
    mockListStationsPublic.mockResolvedValueOnce({
      data: { all: [] },
      meta: { total: 0, page: 1, per_page: 20, total_pages: 1 },
    });
    const req = buildRequest('http://localhost/api/v1/stations?sort=rating_desc,completed_count_desc,name_asc');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockListStationsPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: ['rating_desc', 'completed_count_desc', 'name_asc'],
      })
    );
  });

  it('passes service_scope to service', async () => {
    mockListStationsPublic.mockResolvedValueOnce({
      data: { all: [] },
      meta: { total: 0, page: 1, per_page: 20, total_pages: 1 },
    });
    const req = buildRequest('http://localhost/api/v1/stations?service_scope=interior');
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockListStationsPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        service_scope: 'interior',
      })
    );
  });

  it('returns 400 for invalid service_scope', async () => {
    const req = buildRequest('http://localhost/api/v1/stations?service_scope=invalid');
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('VALIDATION_FAILED');
    expect(mockListStationsPublic).not.toHaveBeenCalled();
  });
});
