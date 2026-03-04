import { successResponse } from '@/lib/responses';
import { AUTH_COOKIE_NAME } from '@/helpers/constants';

/**
 * POST /api/v1/auth/logout
 * Clears the auth cookie, ending the user's session.
 *
 * Responses:
 *   200 { data: { logged_out: true } }
 */
export async function POST() {
  const response = successResponse({ logged_out: true }, 'Logged out successfully');
  response.cookies.delete(AUTH_COOKIE_NAME);
  return response;
}
