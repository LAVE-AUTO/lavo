import { cookies, headers } from 'next/headers';
import { verifyJwt, extractBearerToken, type JwtPayload } from '@/lib/jwt';
import { error401 } from '@/lib/responses';
import { ACCESS_COOKIE_NAME } from '@/helpers/constants';
import type { NextResponse } from 'next/server';
import { assertSafeCookieAuthForMutation } from '@/lib/cookie-auth-csrf';

/**
 * Auth guard for protected route handlers.
 * Reads the JWT from Authorization: Bearer <token> or from the access_token cookie.
 *
 * CSRF: We intentionally do not set `SameSite=Strict` on the access cookie (OAuth and some
 * redirect flows can break). For mutating requests, if the token comes from the cookie only,
 * callers must pass `request` so Origin / Referer or `X-Requested-With` can be checked;
 * Bearer-only mobile/API clients are unaffected.
 *
 * Usage:
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth; // 401 / 403
 *   const { sub, role } = auth; // authenticated payload
 */
export async function requireAuth(request?: Request): Promise<JwtPayload | NextResponse> {
  const headersList = await headers();
  const bearerToken = extractBearerToken(headersList.get('authorization'));
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const token = bearerToken ?? cookieToken ?? null;

  if (!token) return error401();

  if (request) {
    const csrf = assertSafeCookieAuthForMutation(
      request,
      Boolean(bearerToken),
      Boolean(cookieToken && !bearerToken)
    );
    if (csrf) return csrf;
  }

  const payload = await verifyJwt(token);
  if (!payload) return error401('Session expired or invalid');

  return payload;
}
