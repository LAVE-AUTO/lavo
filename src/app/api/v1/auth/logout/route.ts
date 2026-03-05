import { cookies } from 'next/headers';
import { successResponse, error500 } from '@/lib/responses';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/helpers/constants';
import { revokeAllRefreshTokensForUser } from '@/server/auth/refresh-token-repository';
import { verifyJwt } from '@/lib/jwt';

/**
 * POST /api/v1/auth/logout
 * Revokes the refresh token in DB and clears both auth cookies.
 *
 * Responses:
 *   200 { data: { logged_out: true } }
 */
export async function POST() {
  const cookieStore = await cookies();

  // Best-effort DB revocation via access token (ignore if expired/missing)
  const accessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
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

  const response = successResponse({ logged_out: true }, 'Logged out successfully');
  response.cookies.delete(ACCESS_COOKIE_NAME);
  response.cookies.delete(REFRESH_COOKIE_NAME);
  return response;
}
