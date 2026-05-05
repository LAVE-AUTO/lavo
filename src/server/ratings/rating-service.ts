/**
 * Rating business logic: submit, list public/admin, and moderation operations.
 *
 * Features:
 *   - submitRating: client submits rating for completed reservation with time-window and uniqueness checks
 *   - getPublicRatings: public listing with pagination
 *   - listAllAdminRatings: admin moderation interface with filtering
 *   - toggleRatingVisibility: show/hide ratings for moderation (with idempotency and audit logging)
 *
 * Validation:
 *   - Ownership check: only client who made reservation can rate it
 *   - Status check: reservation must be completed
 *   - Window check: rating must be submitted within configurable days of completion
 *   - Uniqueness check: one rating per reservation (enforced at DB level)
 *
 * Audit:
 *   - Admin moderation actions are logged for compliance
 *   - Station aggregate rating recalculated after each change
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
  listRatingsByUser,
  recalcStationRating,
  updateRatingVisibility,
  type AdminRatingItem,
  type AdminRatingsFilters,
  type PublicRatingItem,
  type Rating,
  type UserRatingItem,
} from './ratings-repository';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';
import { refreshStationStats } from '@/server/station/station-stats-service';


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

  // 4. Configurable rating window since completed_at (fallback updated_at)
  const completedAt = owned.completed_at ?? owned.updated_at;
  const ratingWindowDaysRaw = parseInt(
    await getPlatformSettingWithFallback('rating_window_days', 'PLATFORM_RATING_WINDOW_DAYS', '7'),
    10
  );
  const ratingWindowDays = Number.isFinite(ratingWindowDaysRaw) && ratingWindowDaysRaw > 0
    ? ratingWindowDaysRaw
    : 7;
  const ratingWindowMs = ratingWindowDays * 86400000;
  if (Date.now() - completedAt.getTime() > ratingWindowMs) {
    throw new RatingWindowExpiredError(`The ${ratingWindowDays}-day rating window has expired`);
  }

  // 5. Not already rated
  const existing = await findRatingByReservationId(body.reservation_id);
  if (existing) throw new AlreadyRatedError('This reservation has already been rated');

  // 6. Transaction: insert + recalc. Catch DB-level unique constraint violation
  // (race condition between pre-check and insert) and surface as 409 ALREADY_RATED.
  let rating: Rating;
  try {
    rating = await db.transaction(async (tx) => {
      const inserted = await insertRating(
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
      return inserted;
    });
  } catch (err) {
    // PostgreSQL unique_violation code is '23505'
    if (err instanceof Error && (err as Error & { code?: string }).code === '23505') {
      throw new AlreadyRatedError('This reservation has already been rated');
    }
    throw err;
  }

  // Refresh station_stats so average_rating and total_ratings stay current.
  // Fire-and-forget: do not block the response if the view refresh is slow or errors.
  refreshStationStats().catch((err) => {
    console.error('[STATION_STATS_REFRESH] Failed after rating insert', {
      reservationId: body.reservation_id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  return rating;
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
  items: PublicRatingItem[];
  meta: PaginationMeta;
}> {
  const station = await findStationById(stationId);
  if (!station) throw new NotFoundError('Station not found');

  const { items, total } = await listPublicRatingsByStation(stationId, page, limit);
  return { items, meta: buildMeta(total, page, limit) };
}


// %%%%% Client rating listing %%%%%
// Get ratings submitted by the current client

/**
 * Lists ratings submitted by a client, paginated by recency.
 */
export async function getMyRatings(
  userId: string,
  page: number,
  limit: number
): Promise<{ items: UserRatingItem[]; meta: PaginationMeta }> {
  const { items, total } = await listRatingsByUser(userId, page, limit);
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
  const result = await db.transaction(async (tx) => {
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

  // Refresh station_stats when visibility actually changed (result.updated = true).
  // Fire-and-forget: do not block the response if the view refresh is slow or errors.
  if (result.updated) {
    refreshStationStats().catch((err) => {
      console.error('[STATION_STATS_REFRESH] Failed after rating visibility toggle', {
        ratingId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return result;
}
