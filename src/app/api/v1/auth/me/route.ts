import { cookies } from 'next/headers';
import { verifyJwt } from '@/lib/jwt';
import { findById } from '@/server/auth/user-repository';
import {
  successResponse,
  error401,
  error500,
} from '@/lib/responses';
import { AUTH_COOKIE_NAME } from '@/helpers/constants';

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile from the httpOnly cookie.
 *
 * Responses:
 *   200 { data: SafeUser }
 *   401 UNAUTHORIZED — missing or invalid token
 *   500 INTERNAL_ERROR
 */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) return error401();

  const payload = await verifyJwt(token);
  if (!payload) return error401('Session expired or invalid');

  try {
    const user = await findById(payload.sub);
    if (!user) return error401('User not found');

    return successResponse(user);
  } catch (e) {
    return error500(e);
  }
}
