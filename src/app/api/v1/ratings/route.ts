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
 *   403 FORBIDDEN — reservation does not belong to user
 *   404 NOT_FOUND — reservation not found
 *   409 CONFLICT — RESERVATION_NOT_COMPLETED | RATING_WINDOW_EXPIRED | ALREADY_RATED
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error403,
  error404,
  error409,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { HTTP_STATUS } from '@/helpers/constants';
import {
  AlreadyRatedError,
  AppError,
  ForbiddenError,
  NotFoundError,
  RatingWindowExpiredError,
  ReservationNotCompletedError,
} from '@/lib/errors';
import { postRatingBodySchema, mapZodErrors } from '@/validators/ratings';
import { submitRating } from '@/server/ratings/rating-service';
import type { NextResponse } from 'next/server';


// %%%%% Endpoint handler %%%%%
// POST /api/v1/ratings

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body');
  }

  const parsed = postRatingBodySchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  // Submit rating; handle validation and business logic errors
  try {
    const rating = await submitRating(auth.sub, parsed.data);
    return successResponse(
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
    );
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ForbiddenError) return error403(e.message);
    if (e instanceof ReservationNotCompletedError)
      return error409(e.message, ApiCode.RESERVATION_NOT_COMPLETED);
    if (e instanceof RatingWindowExpiredError)
      return error409(e.message, ApiCode.RATING_WINDOW_EXPIRED);
    if (e instanceof AlreadyRatedError) return error409(e.message, ApiCode.ALREADY_RATED);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
