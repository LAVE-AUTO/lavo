import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError } from '@/lib/errors';
import {
  adminIdParamSchema,
  updateUserSchema,
  mapZodErrors,
} from '@/validators/admin-user';
import { updateUser } from '@/server/admin/admin-management-service';
import type { NextResponse } from 'next/server';

/**
 * PUT /api/v1/admin/users/:id
 * Updates whitelisted fields on a user account.
 * Logs the action in admin_logs with full before/after snapshot.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: AdminSafeUser }
 *   400 VALIDATION_FAILED  - invalid UUID param or body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND          - user not found
 *   500 INTERNAL_ERROR
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;
  const paramParsed = adminIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid user id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const user = await updateUser(auth.sub, paramParsed.data.id, parsed.data);
    return applyNoStoreHeaders(successResponse(user, 'User updated successfully'));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
