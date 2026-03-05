import { cookies } from 'next/headers';
import { refreshSession } from '@/server/auth/auth-service';
import { buildAccessCookieOptions, buildRefreshCookieOptions } from '@/lib/jwt';
import { successResponse, error401, error500 } from '@/lib/responses';
import { UnauthorizedError } from '@/lib/errors';
import { REFRESH_COOKIE_NAME } from '@/helpers/constants';

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and issues a new access token.
 * Old refresh token is revoked in DB.
 *
 * Responses:
 *   200 { data: { refreshed: true } }
 *   401 UNAUTHORIZED — missing or invalid refresh token
 *   500 INTERNAL_ERROR
 */
export async function POST() {
  const cookieStore = await cookies();
  const rawRefreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!rawRefreshToken) return error401();

  try {
    const { tokens, rememberMe } = await refreshSession(rawRefreshToken);

    const response = successResponse({ refreshed: true });
    const accessOpts = buildAccessCookieOptions();
    const refreshOpts = buildRefreshCookieOptions(rememberMe);

    response.cookies.set(accessOpts.name, tokens.accessJwt, accessOpts);
    response.cookies.set(refreshOpts.name, tokens.rawRefreshToken, refreshOpts);
    return response;
  } catch (e) {
    if (e instanceof UnauthorizedError) return error401();
    return error500(e);
  }
}
