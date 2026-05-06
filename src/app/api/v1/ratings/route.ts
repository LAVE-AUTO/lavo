/**
 * Ratings API endpoint.
 *
 * POST /api/v1/ratings - Submit a rating for a completed reservation.
 *   - Auth: client (authenticated user)
 *   - Body: { reservation_id: UUID, score: 1-5, comment?: string }
 *   - Max comment length: configurable via platform settings (default 500)
 *   - Rate limit: 10 requests per minute per user
 *
 * Validation:
 *   - Reservation must exist and belong to client
 *   - Reservation must be completed
 *   - Rating must be submitted within configurable window (default 7 days)
 *   - One rating per reservation (unique constraint)
 *
 * Success response (201):
 *   { data: { id, reservation_id, station_id, score, comment, is_visible, created_at } }
 *
 * Error responses:
 *   - 400 VALIDATION_FAILED - malformed request or invalid values
 *   - 401 UNAUTHORIZED - client auth required
 *   - 404 NOT_FOUND - reservation not found or doesn't belong to user
 *   - 409 CONFLICT - RESERVATION_NOT_COMPLETED | RATING_WINDOW_EXPIRED | ALREADY_RATED
 *   - 429 TOO_MANY_REQUESTS - rate limited (10 req/min per user)
 *   - 500 INTERNAL_ERROR - database or service error
 */
import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error404,
  error409,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { HTTP_STATUS } from '@/helpers/constants';
import {
  AlreadyRatedError,
  AppError,
  NotFoundError,
  RatingWindowExpiredError,
  ReservationNotCompletedError,
} from '@/lib/errors';
import { createRatingCommentSchema, mapZodErrors } from '@/validators/ratings';
import { submitRating } from '@/server/ratings/rating-service';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import type { NextResponse } from 'next/server';


// %%%%% Rate limiting %%%%%
// Per-user request throttling

/** 10 requests per minute per authenticated user. */
const ratingsLimiter = createEndpointRateLimiter({ maxRequests: 10, windowMs: 60_000 });


// %%%%% POST handler %%%%%
// Submit rating for completed reservation

/**
 * POST /api/v1/ratings
 *
 * Submits a rating for a completed reservation.
 * Validates ownership, reservation status, rating window, and uniqueness.
 * Returns the created rating with metadata.
 */
export async function POST(request: Request): Promise<NextResponse> {
  // Authenticate as client
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  // Check rate limit
  if (ratingsLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  // Build validation schema with platform-configured max comment length
  const maxCommentLength = parseInt(
    await getPlatformSettingWithFallback('max_rating_comment_length', 'PLATFORM_MAX_RATING_COMMENT_LENGTH', '500'),
    10
  );
  const postRatingBodySchema = createRatingCommentSchema(
    Number.isFinite(maxCommentLength) && maxCommentLength > 0 ? maxCommentLength : 500
  );

  // Validate request body
  const parsed = postRatingBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  // Submit rating and handle errors
  try {
    const rating = await submitRating(auth.sub, parsed.data);
    return applyNoStoreHeaders(
      successResponse(
        {
          id: rating.id,
          reservation_id: rating.reservation_id,
          station_id: rating.station_id,
          score: rating.score,
          comment: rating.comment,
          is_visible: rating.is_visible,
          created_at: rating.created_at,
        },
        undefined,
        HTTP_STATUS.CREATED
      )
    );
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ReservationNotCompletedError)
      return applyNoStoreHeaders(error409(e.message, ApiCode.RESERVATION_NOT_COMPLETED));
    if (e instanceof RatingWindowExpiredError)
      return applyNoStoreHeaders(error409(e.message, ApiCode.RATING_WINDOW_EXPIRED));
    if (e instanceof AlreadyRatedError) return applyNoStoreHeaders(error409(e.message, ApiCode.ALREADY_RATED));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
