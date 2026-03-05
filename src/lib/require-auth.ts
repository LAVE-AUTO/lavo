import { cookies } from 'next/headers';
import { verifyJwt, type JwtPayload } from '@/lib/jwt';
import { error401 } from '@/lib/responses';
import { ACCESS_COOKIE_NAME } from '@/helpers/constants';
import type { NextResponse } from 'next/server';

/**
 * Auth guard for protected route handlers.
 * Extracts and verifies the access_token cookie.
 *
 * Usage:
 *   const result = await requireAuth();
 *   if (result instanceof NextResponse) return result; // 401
 *   const { sub, role } = result; // authenticated payload
 */
export async function requireAuth(): Promise<JwtPayload | NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;

  if (!token) return error401();

  const payload = await verifyJwt(token);
  if (!payload) return error401('Session expired or invalid');

  return payload;
}
