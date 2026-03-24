/**
 * API tests for PATCH /api/v1/admin/ratings/:id.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockToggleRatingVisibility = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/ratings/rating-service', () => ({
  toggleRatingVisibility: (...args: unknown[]) => mockToggleRatingVisibility(...args),
}));

import { PATCH } from '@/app/api/v1/admin/ratings/[id]/route';
import { NotFoundError } from '@/lib/errors';

const adminAuth = { sub: 'admin-1', role: 'admin' };
const ratingId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

function buildParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

function makeRequest(id: string, body?: unknown): Request {
  return new Request(`http://localhost/api/v1/admin/ratings/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const ratingFixture = {
  id: ratingId,
  reservation_id: 'b1b2c3d4-e5f6-7890-abcd-ef1234567890',
  user_id: 'user-1',
  station_id: 'station-1',
  score: 4,
  comment: 'Good',
  is_visible: false,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('PATCH /api/v1/admin/ratings/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(adminAuth);
  });

  // --- Happy path ---

  it('returns 200 with updated:true when hiding a visible rating', async () => {
    mockToggleRatingVisibility.mockResolvedValueOnce({
      ...ratingFixture,
      is_visible: false,
      updated: true,
    });
    const res = await PATCH(makeRequest(ratingId, { is_visible: false }), {
      params: buildParams(ratingId),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.updated).toBe(true);
    expect(body.data.is_visible).toBe(false);
    expect(mockToggleRatingVisibility).toHaveBeenCalledWith(ratingId, false, adminAuth.sub);
  });

  it('returns 200 with updated:true when restoring a hidden rating', async () => {
    mockToggleRatingVisibility.mockResolvedValueOnce({
      ...ratingFixture,
      is_visible: true,
      updated: true,
    });
    const res = await PATCH(makeRequest(ratingId, { is_visible: true }), {
      params: buildParams(ratingId),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.updated).toBe(true);
    expect(body.data.is_visible).toBe(true);
  });

  it('returns 200 with updated:false when the value is the same (idempotent)', async () => {
    mockToggleRatingVisibility.mockResolvedValueOnce({
      ...ratingFixture,
      is_visible: true,
      updated: false,
    });
    const res = await PATCH(makeRequest(ratingId, { is_visible: true }), {
      params: buildParams(ratingId),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.updated).toBe(false);
  });

  // --- Not found (404) ---

  it('returns 404 when the rating does not exist', async () => {
    mockToggleRatingVisibility.mockRejectedValueOnce(new NotFoundError('Rating not found'));
    const res = await PATCH(makeRequest(ratingId, { is_visible: false }), {
      params: buildParams(ratingId),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Rating not found');
  });

  // --- Validation (400) ---

  it('returns 400 when body does not contain is_visible', async () => {
    const res = await PATCH(makeRequest(ratingId, {}), {
      params: buildParams(ratingId),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockToggleRatingVisibility).not.toHaveBeenCalled();
  });

  // --- Auth errors ---

  it('returns 403 when role is not admin', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await PATCH(makeRequest(ratingId, { is_visible: false }), {
      params: buildParams(ratingId),
    });
    expect(res.status).toBe(403);
    expect(mockToggleRatingVisibility).not.toHaveBeenCalled();
  });
});
