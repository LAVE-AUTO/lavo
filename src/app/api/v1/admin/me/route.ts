import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { adminProfileUpdateSchema, mapZodErrors } from '@/validators/admin-user';
import { getAdminProfile, updateAdminProfile } from '@/server/admin/admin-profile-service';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/me
 * Returns the authenticated admin's profile (no password_hash, no stripe_customer_id).
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: SafeAdminProfile }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function GET(_request: Request): Promise<NextResponse> {
  const auth = await requireRole(undefined, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const profile = await getAdminProfile(auth.sub);
    return applyNoStoreHeaders(successResponse(profile));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}


/**
 * PATCH /api/v1/admin/me
 * Updates the authenticated admin's basic profile (first_name, last_name, phone).
 * Logs the change in admin_logs.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: SafeAdminProfile }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = adminProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const profile = await updateAdminProfile(auth.sub, parsed.data);
    return applyNoStoreHeaders(successResponse(profile, 'Profile updated successfully'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
