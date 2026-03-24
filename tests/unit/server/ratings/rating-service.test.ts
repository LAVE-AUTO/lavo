/**
 * Unit tests for rating-service: submitRating business logic and race condition handler.
 * @jest-environment node
 */
const mockFindEntryById = jest.fn();
const mockFindEntryByIdAndUser = jest.fn();
const mockFindStationById = jest.fn();
const mockFindRatingByReservationId = jest.fn();
const mockFindRatingById = jest.fn();
const mockInsertRating = jest.fn();
const mockRecalcStationRating = jest.fn();
const mockUpdateRatingVisibility = jest.fn();
const mockInsertAdminLog = jest.fn();
const mockListAdminRatings = jest.fn();
const mockListPublicRatingsByStation = jest.fn();

jest.mock('@/server/reservations/entry-repository', () => ({
  findEntryById: (...args: unknown[]) => mockFindEntryById(...args),
  findEntryByIdAndUser: (...args: unknown[]) => mockFindEntryByIdAndUser(...args),
}));

jest.mock('@/server/station/station-repository', () => ({
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
}));

jest.mock('@/server/ratings/ratings-repository', () => ({
  findRatingByReservationId: (...args: unknown[]) => mockFindRatingByReservationId(...args),
  findRatingById: (...args: unknown[]) => mockFindRatingById(...args),
  insertRating: (...args: unknown[]) => mockInsertRating(...args),
  recalcStationRating: (...args: unknown[]) => mockRecalcStationRating(...args),
  updateRatingVisibility: (...args: unknown[]) => mockUpdateRatingVisibility(...args),
  insertAdminLog: (...args: unknown[]) => mockInsertAdminLog(...args),
  listAdminRatings: (...args: unknown[]) => mockListAdminRatings(...args),
  listPublicRatingsByStation: (...args: unknown[]) => mockListPublicRatingsByStation(...args),
}));

jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import { submitRating, toggleRatingVisibility, getPublicRatings } from '@/server/ratings/rating-service';
import {
  AlreadyRatedError,
  ForbiddenError,
  NotFoundError,
  RatingWindowExpiredError,
  ReservationNotCompletedError,
} from '@/lib/errors';

const userId = 'user-1';
const reservationId = 'res-uuid-0001-0000-0000-000000000001';
const stationId = 'station-uuid-0001-000000000001';
const ratingId = 'rating-uuid-0001-000000000001';

const now = new Date();
const completedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago — within window

const completedEntry = {
  id: reservationId,
  user_id: userId,
  station_id: stationId,
  status: 'completed',
  completed_at: completedAt,
  updated_at: completedAt,
};

const insertedRating = {
  id: ratingId,
  reservation_id: reservationId,
  user_id: userId,
  station_id: stationId,
  score: 4,
  comment: 'Great',
  is_visible: true,
  created_at: now,
};

describe('submitRating', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindEntryById.mockResolvedValue(completedEntry);
    mockFindEntryByIdAndUser.mockResolvedValue(completedEntry);
    mockFindRatingByReservationId.mockResolvedValue(undefined);
    mockInsertRating.mockResolvedValue(insertedRating);
    mockRecalcStationRating.mockResolvedValue(undefined);
  });

  // --- Happy path ---

  it('inserts a rating and recalcs station stats in a transaction', async () => {
    const result = await submitRating(userId, { reservation_id: reservationId, score: 4, comment: 'Great' });
    expect(result.id).toBe(ratingId);
    expect(mockInsertRating).toHaveBeenCalledTimes(1);
    expect(mockRecalcStationRating).toHaveBeenCalledWith(stationId, expect.anything());
  });

  // --- Pre-check guard errors ---

  it('throws NotFoundError when reservation does not exist', async () => {
    mockFindEntryById.mockResolvedValue(undefined);
    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow(NotFoundError);
  });

  it('throws ForbiddenError when reservation belongs to another user', async () => {
    mockFindEntryByIdAndUser.mockResolvedValue(undefined);
    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow(ForbiddenError);
  });

  it('throws ReservationNotCompletedError when status is not completed', async () => {
    mockFindEntryByIdAndUser.mockResolvedValue({ ...completedEntry, status: 'confirmed' });
    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow(ReservationNotCompletedError);
  });

  it('throws RatingWindowExpiredError when completed_at is more than 7 days ago', async () => {
    const expiredAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    mockFindEntryByIdAndUser.mockResolvedValue({ ...completedEntry, completed_at: expiredAt });
    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow(RatingWindowExpiredError);
  });

  it('uses updated_at as fallback when completed_at is null', async () => {
    const expiredAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    mockFindEntryByIdAndUser.mockResolvedValue({ ...completedEntry, completed_at: null, updated_at: expiredAt });
    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow(RatingWindowExpiredError);
  });

  it('throws AlreadyRatedError when a rating already exists (pre-check)', async () => {
    mockFindRatingByReservationId.mockResolvedValue(insertedRating);
    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow(AlreadyRatedError);
  });

  // --- Race condition: DB unique constraint violation (23505) ---

  it('maps PostgreSQL error 23505 to AlreadyRatedError (race condition path)', async () => {
    // Simulate a concurrent insert winning the race: the pre-check passed (no existing rating)
    // but the DB throws a unique_violation on the INSERT itself.
    const pgUniqueViolation = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
    });
    mockInsertRating.mockRejectedValue(pgUniqueViolation);

    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow(AlreadyRatedError);
  });

  it('re-throws non-23505 DB errors without wrapping', async () => {
    const dbError = Object.assign(new Error('connection refused'), { code: '08006' });
    mockInsertRating.mockRejectedValue(dbError);

    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toThrow('connection refused');
    // Must NOT be wrapped in AlreadyRatedError
    await expect(
      submitRating(userId, { reservation_id: reservationId, score: 4 })
    ).rejects.not.toThrow(AlreadyRatedError);
  });

  it('re-throws non-Error thrown values without wrapping', async () => {
    // A string thrown (unusual but valid JS) must not be caught by the instanceof Error guard
    mockInsertRating.mockRejectedValue('raw string error');
    await expect(submitRating(userId, { reservation_id: reservationId, score: 4 })).rejects.toBe('raw string error');
  });
});


describe('getPublicRatings', () => {
  const station = { id: stationId, name: 'Station Alpha' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindStationById.mockResolvedValue(station);
    mockListPublicRatingsByStation.mockResolvedValue({
      items: [{ id: ratingId, score: 4, comment: 'Nice', created_at: now }],
      total: 1,
    });
  });

  it('returns items and correct pagination meta', async () => {
    const result = await getPublicRatings(stationId, 1, 10);
    expect(result.items).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.total_pages).toBe(1);
    expect(result.meta.has_next_page).toBe(false);
    expect(result.meta.has_prev_page).toBe(false);
  });

  it('throws NotFoundError when station does not exist', async () => {
    mockFindStationById.mockResolvedValue(undefined);
    await expect(getPublicRatings(stationId, 1, 10)).rejects.toThrow(NotFoundError);
  });
});


describe('toggleRatingVisibility', () => {
  const existingRating = {
    id: ratingId,
    reservation_id: reservationId,
    user_id: userId,
    station_id: stationId,
    score: 4,
    comment: 'Good',
    is_visible: true,
    created_at: now,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindRatingById.mockResolvedValue(existingRating);
    mockUpdateRatingVisibility.mockResolvedValue({ ...existingRating, is_visible: false });
    mockRecalcStationRating.mockResolvedValue(undefined);
    mockInsertAdminLog.mockResolvedValue(undefined);
  });

  it('returns updated:true and runs recalc + audit log when visibility changes', async () => {
    const result = await toggleRatingVisibility(ratingId, false, 'admin-1');
    expect(result.updated).toBe(true);
    expect(result.is_visible).toBe(false);
    expect(mockUpdateRatingVisibility).toHaveBeenCalledTimes(1);
    expect(mockRecalcStationRating).toHaveBeenCalledWith(stationId, expect.anything());
    expect(mockInsertAdminLog).toHaveBeenCalledTimes(1);
  });

  it('returns updated:false and skips DB writes when same visibility (idempotent)', async () => {
    const result = await toggleRatingVisibility(ratingId, true, 'admin-1');
    expect(result.updated).toBe(false);
    expect(mockUpdateRatingVisibility).not.toHaveBeenCalled();
    expect(mockRecalcStationRating).not.toHaveBeenCalled();
    expect(mockInsertAdminLog).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when rating does not exist (pre-check path)', async () => {
    mockFindRatingById.mockResolvedValue(undefined);
    await expect(toggleRatingVisibility(ratingId, false, 'admin-1')).rejects.toThrow(NotFoundError);
  });

  it('throws NotFoundError when rating is deleted between pre-check and in-tx re-read (race condition)', async () => {
    // Pre-check (no tx arg) finds the rating; in-tx re-read (with tx arg) finds nothing.
    mockFindRatingById
      .mockResolvedValueOnce(existingRating) // pre-check outside tx
      .mockResolvedValueOnce(undefined);     // re-read inside tx — concurrent delete
    await expect(toggleRatingVisibility(ratingId, false, 'admin-1')).rejects.toThrow(NotFoundError);
    expect(mockUpdateRatingVisibility).not.toHaveBeenCalled();
    expect(mockRecalcStationRating).not.toHaveBeenCalled();
    expect(mockInsertAdminLog).not.toHaveBeenCalled();
  });
});
