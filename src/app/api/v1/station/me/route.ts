import { requireRole } from '@/lib/require-role';
import { getMyStation, updateMyStation } from '@/server/station/station-service';
import { findDocumentsByStationId } from '@/server/station/document-repository';
import { successResponse, error400, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { updateStationProfileBodySchema, mapZodErrors } from '@/validators/station';
import { ApiCode } from '@/types/api-codes';
import type { Station } from '@/server/station/station-repository';
import type { StationDocument } from '@/server/station/document-repository';
import type { NextResponse } from 'next/server';

function serializeStation(station: Station, documents: StationDocument[]) {
  const photos = documents
    .filter((d) => d.document_type === 'photo')
    .map((d) => d.file_url);
  const kyc_documents = documents.filter((d) => d.document_type !== 'photo');
  // Omit internal/sensitive columns that must not be exposed to the station owner.
  const {
    stripe_account_id: _stripe,
    rejection_reason: _rejection,
    approved_by: _approvedBy,
    approved_at: _approvedAt,
    ...publicStation
  } = station;
  return { ...publicStation, photos, documents: kyc_documents };
}

/**
 * GET /api/v1/station/me
 * Return the authenticated station's profile including KYC documents and photo URLs.
 * Requires an active station account (approved by admin).
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
    const { documents, ...station } = await getMyStation(auth.sub);
    return applyNoStoreHeaders(successResponse(serializeStation(station, documents)));
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
 *   name, description, address, city, latitude, longitude, service_scope, wash_post_count
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
    const updated = await updateMyStation(auth.sub, parsed.data);
    const documents = await findDocumentsByStationId(updated.id);
    return applyNoStoreHeaders(successResponse(serializeStation(updated, documents)));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ForbiddenError) return applyNoStoreHeaders(error403(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
