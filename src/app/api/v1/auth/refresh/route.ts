import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { refreshSession } from '@/server/auth/auth-service';
import { successResponse, error401, error500 } from '@/lib/responses';
import { UnauthorizedError } from '@/lib/errors';
import { buildRefreshCookieOptions } from '@/lib/jwt';
import { REFRESH_COOKIE_NAME } from '@/helpers/constants';

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token and issues a new access token.
 * Reads the refresh token from the httpOnly cookie, revokes it, and issues a new pair.
 *
 * Responses:
 *   200 { data: { user, access_token, token_type, expires_in } }
 *   401 UNAUTHORIZED — missing, invalid, or expired refresh token
 *   500 INTERNAL_ERROR
 */
export async function POST() {
  const cookieStore = await cookies();
  const rawRefreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value ?? null;

  if (!rawRefreshToken) {
    return error401();
  }

  try {
    const { user, tokens } = await refreshSession(rawRefreshToken);

    const res = successResponse({
      user,
      access_token: tokens.accessJwt,
      token_type: 'Bearer',
      expires_in: tokens.expiresIn,
    });

    const response = NextResponse.json(await res.json(), { status: res.status });
    response.cookies.set(
      REFRESH_COOKIE_NAME,
      tokens.rawRefreshToken,
      buildRefreshCookieOptions(),
    );
    return response;
  } catch (e) {
    if (e instanceof UnauthorizedError) return error401();
    return error500(e);
  }
}
