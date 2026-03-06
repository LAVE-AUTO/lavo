import { cookies, headers } from 'next/headers';
import { verifyJwt, extractBearerToken, type JwtPayload } from '@/lib/jwt';
import { error401 } from '@/lib/responses';
import { ACCESS_COOKIE_NAME } from '@/helpers/constants';
import type { NextResponse } from 'next/server';

/**
 * Auth guard for protected route handlers.
 * Reads the JWT from Authorization: Bearer <token> or from the access_token cookie.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth; // 401
 *   const { sub, role } = auth; // authenticated payload
 */
export async function requireAuth(): Promise<JwtPayload | NextResponse> {
  const headersList = await headers();
  const bearerToken = extractBearerToken(headersList.get('authorization'));
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const token = bearerToken ?? cookieToken ?? null;

  if (!token) return error401();

  const payload = await verifyJwt(token);
  if (!payload) return error401('Session expired or invalid');

  return payload;
}
