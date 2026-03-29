/**
 * API tests for POST /api/v1/ratings.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockSubmitRating = jest.fn();
const mockGetPlatformSettingWithFallback = jest.fn().mockResolvedValue('500');

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/ratings/rating-service', () => ({
  submitRating: (...args: unknown[]) => mockSubmitRating(...args),
}));
jest.mock('@/server/admin/platform-settings-service', () => ({
  getPlatformSettingWithFallback: (...args: unknown[]) => mockGetPlatformSettingWithFallback(...args),
}));

import { POST } from '@/app/api/v1/ratings/route';
import {
  NotFoundError,
  ForbiddenError,
  AlreadyRatedError,
  RatingWindowExpiredError,
  ReservationNotCompletedError,
} from '@/lib/errors';

const clientAuth = { sub: 'user-1', role: 'client' };

const validReservationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const ratingFixture = {
  id: 'rating-1',
  reservation_id: validReservationId,
  user_id: clientAuth.sub,
  station_id: 'station-1',
  score: 4,
  comment: 'Good service',
  is_visible: true,
  created_at: new Date(),
  updated_at: new Date(),
};

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/v1/ratings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/v1/ratings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockSubmitRating.mockResolvedValue(ratingFixture);
  });

  // --- Happy path ---

  it('returns 201 with rating data when submission is valid', async () => {
    const res = await POST(
      makeRequest({ reservation_id: validReservationId, score: 4, comment: 'Good service' })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe('rating-1');
    expect(body.data.score).toBe(4);
    expect(mockSubmitRating).toHaveBeenCalledWith(
      clientAuth.sub,
      expect.objectContaining({ reservation_id: validReservationId, score: 4 })
    );
  });

  // --- Validation (400) ---

  it('returns 400 when score is 0 (below minimum)', async () => {
    const res = await POST(
      makeRequest({ reservation_id: validReservationId, score: 0 })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSubmitRating).not.toHaveBeenCalled();
  });

  it('returns 400 when score is 6 (above maximum)', async () => {
    const res = await POST(
      makeRequest({ reservation_id: validReservationId, score: 6 })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSubmitRating).not.toHaveBeenCalled();
  });

  it('returns 400 when comment exceeds 500 characters', async () => {
    const res = await POST(
      makeRequest({
        reservation_id: validReservationId,
        score: 3,
        comment: 'x'.repeat(501),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSubmitRating).not.toHaveBeenCalled();
  });

  it('returns 400 when reservation_id is not a UUID', async () => {
    const res = await POST(
      makeRequest({ reservation_id: 'not-a-uuid', score: 3 })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockSubmitRating).not.toHaveBeenCalled();
  });

  // --- Auth (401 / 403) ---

  it('returns 401 when not authenticated', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await POST(makeRequest({ reservation_id: validReservationId, score: 4 }));
    expect(res.status).toBe(401);
    expect(mockSubmitRating).not.toHaveBeenCalled();
  });

  // --- Business errors (403 / 404 / 409) ---

  it('returns 403 when the reservation belongs to another client', async () => {
    mockSubmitRating.mockRejectedValueOnce(new ForbiddenError('Reservation does not belong to you'));
    const res = await POST(makeRequest({ reservation_id: validReservationId, score: 4 }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toMatch(/Reservation does not belong to you/i);
    expect(mockSubmitRating).toHaveBeenCalledTimes(1);
  });

  it('returns 404 when reservation_id does not exist', async () => {
    mockSubmitRating.mockRejectedValueOnce(new NotFoundError('Reservation not found'));
    const res = await POST(makeRequest({ reservation_id: validReservationId, score: 4 }));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Reservation not found');
  });

  it('returns 409 RESERVATION_NOT_COMPLETED when reservation is not completed', async () => {
    mockSubmitRating.mockRejectedValueOnce(
      new ReservationNotCompletedError('The reservation is not completed')
    );
    const res = await POST(makeRequest({ reservation_id: validReservationId, score: 4 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('RESERVATION_NOT_COMPLETED');
  });

  it('returns 409 RATING_WINDOW_EXPIRED when the 7-day rating window has passed', async () => {
    mockSubmitRating.mockRejectedValueOnce(
      new RatingWindowExpiredError('The 7-day rating window has expired')
    );
    const res = await POST(makeRequest({ reservation_id: validReservationId, score: 4 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('RATING_WINDOW_EXPIRED');
  });

  it('returns 409 ALREADY_RATED when the reservation was already rated', async () => {
    mockSubmitRating.mockRejectedValueOnce(
      new AlreadyRatedError('This reservation has already been rated')
    );
    const res = await POST(makeRequest({ reservation_id: validReservationId, score: 4 }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe('ALREADY_RATED');
  });
});
