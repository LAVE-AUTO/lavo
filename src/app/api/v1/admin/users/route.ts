import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error409, error500, fromAppError } from '@/lib/responses';
import { AppError, ConflictError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { listUsers, createUser } from '@/server/admin/admin-management-service';
import { listUsersQuerySchema, createUserSchema, mapZodErrors } from '@/validators/admin-user';
import { ApiCode } from '@/types/api-codes';
import { HTTP_STATUS } from '@/helpers/constants';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/users
 * Lists client accounts with pagination and optional status filter.
 *
 * Query params:
 *   page      (default 1)
 *   per_page  (default 20, max 100)
 *   status    active | suspended | blocked | pending_verification  (omit = all)
 *
 * Responses:
 *   200 { data: { users: AdminUserRow[], meta: PaginationMeta } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const parsed = listUsersQuerySchema.safeParse({
    page:     searchParams.get('page')     || undefined,
    per_page: searchParams.get('per_page') || undefined,
    status:   searchParams.get('status')   || undefined,
  });

  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const result = await listUsers(parsed.data.status, parsed.data.page, parsed.data.per_page);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}


/**
 * POST /api/v1/admin/users
 * Creates a new user account (client or admin role).
 * Auto-generates a temporary password, sets force_password_change=true, and sends a welcome email.
 *
 * Role: admin only.
 *
 * Responses:
 *   201 { data: AdminSafeUser }
 *   400 VALIDATION_FAILED  - invalid body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   409 EMAIL_ALREADY_EXISTS
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const user = await createUser(auth.sub, parsed.data);
    return applyNoStoreHeaders(successResponse(user, 'User created successfully', HTTP_STATUS.CREATED));
  } catch (e) {
    if (e instanceof ConflictError) {
      return applyNoStoreHeaders(
        error409(e.message, ApiCode.EMAIL_ALREADY_EXISTS)
      );
    }
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
