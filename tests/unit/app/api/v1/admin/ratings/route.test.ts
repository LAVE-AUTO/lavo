/**
 * API tests for GET /api/v1/admin/ratings.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockListAllAdminRatings = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/ratings/rating-service', () => ({
  listAllAdminRatings: (...args: unknown[]) => mockListAllAdminRatings(...args),
}));

import { GET } from '@/app/api/v1/admin/ratings/route';

const adminAuth = { sub: 'admin-1', role: 'admin' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const adminRatingItemFixture = {
  id: 'rating-1',
  reservation_id: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
  score: 4,
  comment: 'Excellent',
  is_visible: true,
  created_at: new Date().toISOString(),
  user: { id: 'user-1', first_name: 'Alice', last_name: 'Martin' },
  station: { id: stationId, name: 'Station Alpha' },
};

const defaultServiceResult = {
  items: [adminRatingItemFixture],
  meta: {
    total: 1,
    page: 1,
    limit: 20,
    total_pages: 1,
    has_next_page: false,
    has_prev_page: false,
  },
};

function makeRequest(query = ''): Request {
  return new Request(
    `http://localhost/api/v1/admin/ratings${query ? `?${query}` : ''}`
  );
}

describe('GET /api/v1/admin/ratings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
    mockListAllAdminRatings.mockResolvedValue(defaultServiceResult);
  });

  // --- Happy path ---

  it('returns 200 with admin rating list including client identity fields', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items[0].user.first_name).toBe('Alice');
    expect(body.data.items[0].user.last_name).toBe('Martin');
    expect(body.data.items[0].user.id).toBe('user-1');
    expect(mockListAllAdminRatings).toHaveBeenCalledTimes(1);
  });

  it('passes station_id filter correctly to the service', async () => {
    const res = await GET(makeRequest(`station_id=${stationId}`));
    expect(res.status).toBe(200);
    expect(mockListAllAdminRatings).toHaveBeenCalledWith(
      expect.objectContaining({ station_id: stationId })
    );
  });

  it('passes is_visible=false filter correctly to the service', async () => {
    const res = await GET(makeRequest('is_visible=false'));
    expect(res.status).toBe(200);
    expect(mockListAllAdminRatings).toHaveBeenCalledWith(
      expect.objectContaining({ is_visible: false })
    );
  });

  it('passes score_min and score_max filters correctly to the service', async () => {
    const res = await GET(makeRequest('score_min=2&score_max=4'));
    expect(res.status).toBe(200);
    expect(mockListAllAdminRatings).toHaveBeenCalledWith(
      expect.objectContaining({ score_min: 2, score_max: 4 })
    );
  });

  it('passes from and to date filters correctly to the service', async () => {
    const res = await GET(makeRequest('from=2025-01-01&to=2025-12-31'));
    expect(res.status).toBe(200);
    expect(mockListAllAdminRatings).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2025-01-01', to: '2025-12-31' })
    );
  });

  it('passes sort_by and sort_order filters correctly to the service', async () => {
    const res = await GET(makeRequest('sort_by=score&sort_order=asc'));
    expect(res.status).toBe(200);
    expect(mockListAllAdminRatings).toHaveBeenCalledWith(
      expect.objectContaining({ sort_by: 'score', sort_order: 'asc' })
    );
  });

  // --- Auth errors ---

  it('returns 401 when not authenticated', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockListAllAdminRatings).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not admin', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockListAllAdminRatings).not.toHaveBeenCalled();
  });
});
