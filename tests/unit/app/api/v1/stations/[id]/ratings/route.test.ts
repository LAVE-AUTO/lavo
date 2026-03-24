/**
 * API tests for GET /api/v1/stations/:id/ratings.
 * @jest-environment node
 */
const mockGetPublicRatings = jest.fn();

jest.mock('@/server/ratings/rating-service', () => ({
  getPublicRatings: (...args: unknown[]) => mockGetPublicRatings(...args),
}));

import { GET } from '@/app/api/v1/stations/[id]/ratings/route';
import { NotFoundError } from '@/lib/errors';

const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makeRequest(stationIdInUrl: string, query = ''): Request {
  return new Request(
    `http://localhost/api/v1/stations/${stationIdInUrl}/ratings${query ? `?${query}` : ''}`
  );
}

const publicRatingsFixture = {
  items: [
    { id: 'rating-1', score: 4, comment: 'Great', created_at: new Date().toISOString() },
    { id: 'rating-2', score: 5, comment: null, created_at: new Date().toISOString() },
  ],
  meta: {
    total: 2,
    page: 1,
    limit: 10,
    total_pages: 1,
    has_next_page: false,
    has_prev_page: false,
  },
};

describe('GET /api/v1/stations/:id/ratings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPublicRatings.mockResolvedValue(publicRatingsFixture);
  });

  // --- Happy path ---

  it('returns 200 with paginated visible ratings for a valid station', async () => {
    const res = await GET(makeRequest(stationId), { params: buildParams(stationId) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items).toHaveLength(2);
    expect(mockGetPublicRatings).toHaveBeenCalledWith(stationId, 1, 10);
  });

  it('returns 200 with correct pagination meta', async () => {
    const pagedFixture = {
      items: [{ id: 'rating-1', score: 4, comment: 'Nice', created_at: new Date().toISOString() }],
      meta: {
        total: 25,
        page: 2,
        limit: 10,
        total_pages: 3,
        has_next_page: true,
        has_prev_page: true,
      },
    };
    mockGetPublicRatings.mockResolvedValueOnce(pagedFixture);

    const res = await GET(makeRequest(stationId, 'page=2&limit=10'), {
      params: buildParams(stationId),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.meta.total_pages).toBe(3);
    expect(body.data.meta.has_next_page).toBe(true);
    expect(body.data.meta.has_prev_page).toBe(true);
    expect(mockGetPublicRatings).toHaveBeenCalledWith(stationId, 2, 10);
  });

  // --- Validation (400) ---

  it('returns 400 when station_id path param is not a UUID', async () => {
    const res = await GET(makeRequest('not-a-uuid'), { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetPublicRatings).not.toHaveBeenCalled();
  });

  // --- Not found (404) ---

  it('returns 404 when the station does not exist', async () => {
    mockGetPublicRatings.mockRejectedValueOnce(new NotFoundError('Station not found'));
    const res = await GET(makeRequest(stationId), { params: buildParams(stationId) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Station not found');
  });
});
