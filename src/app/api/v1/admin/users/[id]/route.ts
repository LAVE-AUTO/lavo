import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error403, error404, error409, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, NotFoundError, ConflictError } from '@/lib/errors';
import {
  adminIdParamSchema,
  updateUserSchema,
  deleteEntitySchema,
  mapZodErrors,
} from '@/validators/admin-user';
import { updateUser, deleteUser } from '@/server/admin/admin-management-service';
import { findUserForAdmin } from '@/server/admin/admin-user-repository';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/users/:id
 * Returns a single user record by id.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: AdminSafeUser }
 *   400 VALIDATION_FAILED  - invalid UUID param
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND          - user not found
 *   500 INTERNAL_ERROR
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(undefined, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { id } = await params;
  const paramParsed = adminIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid user id', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error))
    );
  }

  try {
    const user = await findUserForAdmin(paramParsed.data.id);
    if (!user) return applyNoStoreHeaders(error404('User not found'));
    const { stripe_customer_id: _stripe, ...safe } = user;
    return applyNoStoreHeaders(successResponse(safe));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}


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


/**
 * DELETE /api/v1/admin/users/:id
 * Soft-blocks or permanently deletes a user account.
 *
 * Query params:
 *   permanent  true  → hard delete (irreversible)
 *              false → soft delete (status → blocked)  [default]
 *
 * Guards:
 *   - Admin cannot delete their own account.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: { deleted: true } }            hard delete
 *   200 { data: AdminSafeUser }                soft delete
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   409 CONFLICT  - self-delete attempt
 *   500 INTERNAL_ERROR
 */
export async function DELETE(
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

  // Self-delete guard — checked at route level for a clear 403 before any DB call.
  if (auth.sub === paramParsed.data.id) {
    return applyNoStoreHeaders(error403('You cannot delete your own account'));
  }

  const { searchParams } = new URL(request.url);
  const queryParsed = deleteEntitySchema.safeParse({
    permanent: searchParams.get('permanent') ?? 'false',
  });
  if (!queryParsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid query params', ApiCode.VALIDATION_FAILED, mapZodErrors(queryParsed.error))
    );
  }

  try {
    const result = await deleteUser(auth.sub, paramParsed.data.id, queryParsed.data.permanent);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ConflictError) return applyNoStoreHeaders(error409(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
