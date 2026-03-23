import { requireRole } from '@/lib/require-role';
import { extractLocale } from '@/lib/email';
import { approveStation } from '@/server/station/station-service';
import { successResponse, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/admin/stations/:id/approve
 * Approve a station — sets status = active.
 * Requires admin role.
 *
 * Responses:
 *   200 { data: { approved: true } }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN — station not in pending_admin_validation state
 *   404 NOT_FOUND
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

  try {
    await approveStation(auth.sub, id, locale);
    return successResponse({ approved: true }, 'Station approved successfully.');
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ForbiddenError) return error403(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
