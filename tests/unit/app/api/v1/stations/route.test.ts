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

  it('returns 200 and list when query valid', async () => {
    const list = [
      { id: 'id1', name: 'Station One', status: 'active', available_slots: 2, available: true },
    ];
    mockListStationsPublic.mockResolvedValueOnce(list);
    const req = buildRequest(
      'http://localhost/api/v1/stations?q=Paris&city=Lyon&sort=name'
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual(list);
    expect(body.data[0].available_slots).toBe(2);
    expect(body.data[0].available).toBe(true);
    expect(mockListStationsPublic).toHaveBeenCalledWith({
      search: 'Paris',
      city: 'Lyon',
      sort: 'name',
    });
  });

  it('returns 200 with empty params', async () => {
    mockListStationsPublic.mockResolvedValueOnce([]);
    const req = buildRequest('http://localhost/api/v1/stations');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([]);
    expect(mockListStationsPublic).toHaveBeenCalledWith({
      search: undefined,
      city: undefined,
      sort: undefined,
    });
  });

  it('list response contains available and available_slots per item; when no future slots available_slots is 0 and available is false', async () => {
    const list = [
      { id: 'id1', name: 'Station One', status: 'active', available_slots: 2, available: true },
      { id: 'id2', name: 'Station Two', status: 'active', available_slots: 0, available: false },
    ];
    mockListStationsPublic.mockResolvedValueOnce(list);
    const req = buildRequest('http://localhost/api/v1/stations');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].available_slots).toBe(2);
    expect(body.data[0].available).toBe(true);
    expect(body.data[1].available_slots).toBe(0);
    expect(body.data[1].available).toBe(false);
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
});
