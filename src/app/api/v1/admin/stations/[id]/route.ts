import { requireRole } from '@/lib/require-role';
import { getStationById } from '@/server/station/station-service';
import { updateStation } from '@/server/admin/admin-management-service';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import { adminStationIdParamSchema, mapZodErrors } from '@/validators/station';
import { updateStationAdminSchema } from '@/validators/admin-user';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/stations/:id
 * Get full station details including submitted documents.
 * Requires admin role.
 *
 * Responses:
 *   200 { data: StationWithDocuments }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(_request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;

  const paramParsed = adminStationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid station id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  try {
    const station = await getStationById(paramParsed.data.id);
    return applyNoStoreHeaders(successResponse(station));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

/**
 * PUT /api/v1/admin/stations/:id
 * Updates whitelisted fields on a station.
 * Logs the action in admin_logs with full before/after snapshot.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: AdminStation }
 *   400 VALIDATION_FAILED  — invalid UUID param or body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND          — station not found
 *   500 INTERNAL_ERROR
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;

  const paramParsed = adminStationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid station id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = updateStationAdminSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const station = await updateStation(auth.sub, paramParsed.data.id, parsed.data);
    return applyNoStoreHeaders(successResponse(station, 'Station updated successfully'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
