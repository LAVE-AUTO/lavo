import { requireRole } from '@/lib/require-role';
import { rejectStation } from '@/server/station/station-service';
import { rejectStationSchema, mapZodErrors } from '@/validators/station';
import {
  successResponse,
  error400,
  error403,
  error404,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/stations/:id/reject
 * Reject a station — sets status = rejected + rejection_reason.
 * Requires admin role.
 *
 * Body: { rejection_reason }
 *
 * Responses:
 *   200 { data: { rejected: true } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole('admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = rejectStationSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    await rejectStation(auth.sub, id, parsed.data.rejection_reason);
    return successResponse({ rejected: true }, 'Station rejected.');
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ForbiddenError) return error403(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
