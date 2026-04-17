import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { successResponse } from '@/lib/responses';
import { revokeAllRefreshTokensForUser } from '@/server/auth/refresh-token-repository';
import { verifyJwt, extractBearerToken } from '@/lib/jwt';
import { REFRESH_COOKIE_NAME } from '@/helpers/server-constants';

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Log out and revoke all refresh tokens
 *     description: >
 *       Clears the httpOnly refresh token cookie and revokes all refresh tokens for the
 *       user identified by the Bearer access token. The cookie is cleared unconditionally
 *       regardless of DB revocation outcome.
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         logged_out:
 *                           type: boolean
 *                           example: true
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
