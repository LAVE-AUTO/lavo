/**
 * Business logic for ratings: validation, submission, public listing, admin moderation.
 */
import { db } from '@/lib/db';
import {
  AlreadyRatedError,
  NotFoundError,
  RatingWindowExpiredError,
  ReservationNotCompletedError,
} from '@/lib/errors';
import { findEntryByIdAndUser } from '@/server/reservations/entry-repository';
import { findStationById } from '@/server/station/station-repository';
import {
  findRatingByReservationId,
  findRatingById,
  insertAdminLog,
  insertRating,
  listAdminRatings,
  listPublicRatingsByStation,
  recalcStationRating,
  updateRatingVisibility,
  type AdminRatingItem,
  type AdminRatingsFilters,
  type Rating,
} from './ratings-repository';


// %%%%% Constants %%%%%
// Rating submission window (7 days in milliseconds)

const RATING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;


// %%%%% Types %%%%%
// Pagination metadata and input payloads

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
};

export type SubmitRatingData = {
  reservation_id: string;
  score: number;
  comment?: string | null;
};


// %%%%% Helper functions %%%%%
// Build pagination metadata from totals

function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  const total_pages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    total_pages,
    has_next_page: page < total_pages,
    has_prev_page: page > 1,
  };
}


// %%%%% Client rating submission %%%%%
// Validate reservation, check window and eligibility, insert + recalc

/**
 * Submits a rating for a completed reservation. Validates ownership, status, and 7-day window.
 * Handles race-condition unique constraint violations (DB-level duplicate) as 409 ALREADY_RATED.
 */
export async function submitRating(userId: string, body: SubmitRatingData): Promise<Rating> {
  // 1. Ownership check via findEntryByIdAndUser (never by manual comparison).
  // Returns null both when the record does not exist and when it belongs to another user,
  // so we distinguish with a prior existence check handled inside this call.
  const owned = await findEntryByIdAndUser(body.reservation_id, userId);
  if (!owned) throw new NotFoundError('Reservation not found');

  // 3. Status must be completed
  if (owned.status !== 'completed') {
    throw new ReservationNotCompletedError('The reservation is not completed');
  }

  // 4. 7-day window since completed_at (fallback updated_at)
  const completedAt = owned.completed_at ?? owned.updated_at;
  if (Date.now() - completedAt.getTime() > RATING_WINDOW_MS) {
    throw new RatingWindowExpiredError('The 7-day rating window has expired');
  }

  // 5. Not already rated
  const existing = await findRatingByReservationId(body.reservation_id);
  if (existing) throw new AlreadyRatedError('This reservation has already been rated');

  // 6. Transaction: insert + recalc. Catch DB-level unique constraint violation
  // (race condition between pre-check and insert) and surface as 409 ALREADY_RATED.
  try {
    return await db.transaction(async (tx) => {
      const rating = await insertRating(
        {
          reservation_id: body.reservation_id,
          user_id: userId,
          station_id: owned.station_id,
          score: body.score,
          comment: body.comment ?? null,
        },
        tx
      );
      await recalcStationRating(owned.station_id, tx);
      return rating;
    });
  } catch (err) {
    // PostgreSQL unique_violation code is '23505'
    if (err instanceof Error && (err as Error & { code?: string }).code === '23505') {
      throw new AlreadyRatedError('This reservation has already been rated');
    }
    throw err;
  }
}



// %%%%% Public rating listing %%%%%
// Get visible ratings for a station with pagination

/**
 * Lists public (visible) ratings for a station. Validates station exists and returns paginated results.
 */
export async function getPublicRatings(
  stationId: string,
  page: number,
  limit: number
): Promise<{
  items: Pick<Rating, 'id' | 'score' | 'comment' | 'created_at'>[];
  meta: PaginationMeta;
}> {
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  const { items, total } = await listPublicRatingsByStation(stationId, page, limit);
  return { items, meta: buildMeta(total, page, limit) };
}


// %%%%% Admin rating listing %%%%%
// List all ratings with filters for admin moderation interface

/**
 * Lists all ratings with admin filters (station, visibility, score, date, sort, pagination).
 */
export async function listAllAdminRatings(
  filters: AdminRatingsFilters
): Promise<{ items: AdminRatingItem[]; meta: PaginationMeta }> {
  const { items, total } = await listAdminRatings(filters);
  return { items, meta: buildMeta(total, filters.page, filters.limit) };
}


// %%%%% Admin moderation %%%%%
// Toggle rating visibility with audit logging

export type ToggleRatingResult = Rating & { updated: boolean };

/**
 * Toggles a rating's visibility (admin moderation). Idempotent: same value returns updated: false.
 * On change: updates rating, recalcs station stats, and logs the action.
 */
export async function toggleRatingVisibility(
  ratingId: string,
  isVisible: boolean,
  adminId: string
): Promise<ToggleRatingResult> {
  // Pre-check outside transaction for fast 404 path (avoids opening a transaction for missing IDs)
  const preCheck = await findRatingById(ratingId);
  if (!preCheck) throw new NotFoundError('Rating not found');

  // Transaction: re-read inside tx to prevent duplicate audit logs on concurrent PATCH
  return await db.transaction(async (tx) => {
    const rating = await findRatingById(ratingId, tx);
    if (!rating) throw new NotFoundError('Rating not found');

    // Idempotent: same value → no-op (checked inside transaction to avoid race)
    if (rating.is_visible === isVisible) {
      return { ...rating, updated: false };
    }

    const updatedRating = await updateRatingVisibility(ratingId, isVisible, tx);
    await recalcStationRating(rating.station_id, tx);
    await insertAdminLog(
      {
        admin_id: adminId,
        action: 'toggle_rating_visibility',
        target_type: 'rating',
        target_id: ratingId,
        details: {
          station_id: rating.station_id,
          score: rating.score,
          previous_is_visible: rating.is_visible,
          new_is_visible: isVisible,
        },
      },
      tx
    );
    return { ...updatedRating, updated: true };
  });
}
