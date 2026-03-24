/**
 * POST /api/v1/ratings
 * Submit a rating for a completed reservation. Auth: client.
 *
 * Body: { reservation_id, score: 1-5, comment?: string }
 *
 * Responses:
 *   201 { data: { id, reservation_id, station_id, score, comment, is_visible, created_at } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   404 NOT_FOUND — reservation not found or does not belong to user
 *   409 CONFLICT — RESERVATION_NOT_COMPLETED | RATING_WINDOW_EXPIRED | ALREADY_RATED
 *   500 INTERNAL_ERROR
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
import { postRatingBodySchema, mapZodErrors } from '@/validators/ratings';
import { submitRating } from '@/server/ratings/rating-service';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import type { NextResponse } from 'next/server';

/** 10 requests per minute per user. */
const ratingsLimiter = createEndpointRateLimiter({ maxRequests: 10, windowMs: 60_000 });


// %%%%% Endpoint handler %%%%%
// POST /api/v1/ratings

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  if (ratingsLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = postRatingBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  // Submit rating; handle validation and business logic errors
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
