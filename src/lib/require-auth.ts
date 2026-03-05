import { headers } from 'next/headers';
import { verifyJwt, extractBearerToken, type JwtPayload } from '@/lib/jwt';
import { error401 } from '@/lib/responses';
import type { NextResponse } from 'next/server';

/**
 * Auth guard for protected route handlers.
 * Reads the JWT from the Authorization: Bearer <token> header.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth; // 401
 *   const { sub, role } = auth; // authenticated payload
 */
export async function requireAuth(): Promise<JwtPayload | NextResponse> {
  const headersList = await headers();
  const token = extractBearerToken(headersList.get('authorization'));

  if (!token) return error401();

  const payload = await verifyJwt(token);
  if (!payload) return error401('Session expired or invalid');

  return payload;
}
