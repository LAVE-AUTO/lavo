import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { successResponse, error500 } from '@/lib/responses';
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

  // Best-effort DB revocation — if token is missing or expired, still return success
  if (accessToken) {
    const payload = await verifyJwt(accessToken);
    if (payload) {
      try {
        await revokeAllRefreshTokensForUser(payload.sub);
      } catch (e) {
        return error500(e);
      }
    }
  }

  const res = successResponse({ logged_out: true }, 'Logged out successfully');
  const response = NextResponse.json(await res.json(), { status: res.status });

  // Clear the refresh token cookie
  response.cookies.set(REFRESH_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 0,
  });

  return response;
}
