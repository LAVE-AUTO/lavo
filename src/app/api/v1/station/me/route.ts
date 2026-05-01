import { requireRole } from '@/lib/require-role';
import { getMyStation, updateMyStation, type StationWithDocuments } from '@/server/station/station-service';
import { successResponse, error400, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { updateStationProfileBodySchema, mapZodErrors } from '@/validators/station';
import { ApiCode } from '@/types/api-codes';
import type { NextResponse } from 'next/server';


// %%%%% Helpers %%%%%

/**
 * Strips internal/sensitive columns and returns public station shape.
 * photos comes from the dedicated station_photos table (ordered by position).
 * documents contains KYC documents only (photos are no longer in station_documents).
 */
function serializeStation(station: StationWithDocuments) {
  const {
    stripe_account_id: _stripe,
    rejection_reason: _rejection,
    approved_by: _approvedBy,
    approved_at: _approvedAt,
    documents,
    photos,
    ...publicStation
  } = station;
  return { ...publicStation, photos, documents };
}


// %%%%% END - Helpers %%%%%


// %%%%% Route handlers %%%%%

/**
 * GET /api/v1/station/me
 * Return the authenticated station's profile including KYC documents and photo URLs.
 * Requires an authenticated station account.
 * Pending KYC stations are allowed; blocked statuses are handled by role guard.
 *
 * Responses:
 *   200 { data: { ...station, photos: string[], documents: StationDocument[] } }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function GET(): Promise<NextResponse> {
  const auth = await requireRole(undefined, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await getMyStation(auth.sub);
    return applyNoStoreHeaders(successResponse(serializeStation(station)));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ForbiddenError) return applyNoStoreHeaders(error403(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}


/**
 * PATCH /api/v1/station/me
 * Partially update the authenticated station's profile (text fields only).
 * At least one field must be provided. Fields not included are left unchanged.
 *
 * Body (all optional, at least one required):
 *   name, description, address, city, postal_code, latitude, longitude, service_scope, wash_types
 *
 * Responses:
 *   200 { data: { ...station, photos: string[], documents: StationDocument[] } }
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

  const parsed = updateStationProfileBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    await updateMyStation(auth.sub, parsed.data);
    const station = await getMyStation(auth.sub);
    return applyNoStoreHeaders(successResponse(serializeStation(station)));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ForbiddenError) return applyNoStoreHeaders(error403(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}


// %%%%% END - Route handlers %%%%%
