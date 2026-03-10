import { cookies, headers } from 'next/headers';
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
 * To reduce CSRF risk, this endpoint enforces that the request Origin (when present)
 * matches NEXT_PUBLIC_APP_URL/host. Non-browser clients should use the Bearer-token
 * based flows instead of the cookie-based refresh.
 *
 * Responses:
 *   200 { data: { user, access_token, token_type, expires_in } }
 *   401 UNAUTHORIZED — missing, invalid, or expired refresh token
 *   500 INTERNAL_ERROR
 */
export async function POST() {
  const headersList = await headers();
  const origin = headersList.get('origin');
  const host = headersList.get('host');
  const expectedAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (origin && expectedAppUrl) {
    try {
      const originUrl = new URL(origin);
      const appUrl = new URL(expectedAppUrl);
      if (originUrl.host !== appUrl.host) {
        return error401();
      }
    } catch {
      return error401();
    }
  } else if (origin && !expectedAppUrl && host) {
    // Fallback: compare Origin host with the Host header when NEXT_PUBLIC_APP_URL
    // is not configured (e.g. local development).
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return error401();
      }
    } catch {
      return error401();
    }
  }

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
