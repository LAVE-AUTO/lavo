import { requireRole } from '@/lib/require-role';
import { updateMyStationPhotos } from '@/server/station/station-service';
import { successResponse, error400, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { stationPhotosBodySchema, mapZodErrors } from '@/validators/station';
import { ApiCode } from '@/types/api-codes';
import type { NextResponse } from 'next/server';

/**
 * PATCH /api/v1/station/photos
 * Replace all station photo URLs. Existing photos are deleted and replaced with the provided list.
 * URLs must come from a prior call to POST /api/v1/upload (Cloudinary or local fallback).
 *
 * Body:
 *   { "photos": ["https://res.cloudinary.com/...", ...] }  — 1 to 20 URLs
 *
 * Responses:
 *   200 { data: { photos: string[] } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = stationPhotosBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const photos = await updateMyStationPhotos(auth.sub, parsed.data.photos);
    return applyNoStoreHeaders(successResponse({ photos }, 'Photos updated successfully'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ForbiddenError) return applyNoStoreHeaders(error403(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
