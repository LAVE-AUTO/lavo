/**
 * PATCH /api/v1/admin/ratings/:id
 * Toggle visibility of a rating (admin moderation). Auth: admin.
 * Idempotent: same value → 200 { updated: false }, no recalc, no audit log.
 *
 * Params: id (rating UUID)
 * Body: { is_visible: boolean }
 *
 * Responses:
 *   200 { data: { id, is_visible, score, comment, station_id, updated: true|false } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND - rating not found
 *   500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error404,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';
import {
  adminRatingIdParamSchema,
  adminToggleRatingBodySchema,
  mapZodErrors,
} from '@/validators/ratings';
import { toggleRatingVisibility } from '@/server/ratings/rating-service';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';


// %%%%% Endpoint handler %%%%%
// PATCH /api/v1/admin/ratings/:id

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;

  // Validate rating id param
  const paramParsed = adminRatingIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid rating id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  // Parse and validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = adminToggleRatingBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  // Toggle rating visibility; idempotent
  try {
    const result = await toggleRatingVisibility(
      paramParsed.data.id,
      parsed.data.is_visible,
      auth.sub
    );
    return applyNoStoreHeaders(
      successResponse({
        id: result.id,
        is_visible: result.is_visible,
        score: result.score,
        comment: result.comment,
        station_id: result.station_id,
        updated: result.updated,
      })
    );
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
