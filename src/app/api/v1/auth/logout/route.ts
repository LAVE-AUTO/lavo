import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { successResponse } from '@/lib/responses';
import { revokeAllRefreshTokensForUser } from '@/server/auth/refresh-token-repository';
import { verifyJwt, extractBearerToken } from '@/lib/jwt';
import { REFRESH_COOKIE_NAME } from '@/helpers/constants';

/**
 * POST /api/v1/auth/logout
 * Revokes all refresh tokens for the user identified by the Bearer access token.
 * Clears the httpOnly refresh token cookie.
 *
 * Headers: Authorization: Bearer <access_token>
 *
 * Responses:
 *   200 { data: { logged_out: true } }
 */
export async function POST() {
  const headersList = await headers();
  const accessToken = extractBearerToken(headersList.get('authorization'));

  // Build the response and clear the cookie FIRST, unconditionally.
  // The client-side session must be terminated regardless of whether the DB
  // revocation succeeds — a failed DB call must never leave the cookie active.
  const res = successResponse({ logged_out: true }, 'Logged out successfully');
  const response = NextResponse.json(await res.json(), { status: res.status });
  response.cookies.set(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 0,
  });

  // Best-effort DB revocation — errors are logged but do not affect the response.
  // The access token is short-lived; the cookie is already cleared above.
  if (accessToken) {
    const payload = await verifyJwt(accessToken);
    if (payload) {
      revokeAllRefreshTokensForUser(payload.sub).catch((e) => {
        console.error('[logout] Failed to revoke refresh tokens for user', payload.sub, e);
      });
    }
  }

  return response;
}
