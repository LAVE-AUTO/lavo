import { requireRole } from '@/lib/require-role';
import { extractLocale } from '@/lib/email';
import { approveStation } from '@/server/station/station-service';
import { isAdminActionRateLimited } from '@/server/admin/admin-log-repository';
import { successResponse, error400, error404, error409, error429, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/stations/:id/approve
 * Approve a station — sets status = active.
 * Requires admin role.
 *
 * Responses:
 *   200 { data: { approved: true } }
 *   400 VALIDATION_FAILED — :id is not a valid UUID
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND — station or owner not found
 *   409 CONFLICT — station not in pending_admin_validation state
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const locale = extractLocale(request.headers.get('accept-language'));

  // H-3: Validate :id is a UUID before hitting the DB.
  const parsed = stationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  // H-4: Rate limit — max 20 approve/reject actions per admin per minute.
  if (await isAdminActionRateLimited(auth.sub, ['station_approved', 'station_rejected'])) {
    return error429();
  }

  try {
    await approveStation(auth.sub, parsed.data.id, locale);
    return successResponse({ approved: true }, 'Station approved successfully.');
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
