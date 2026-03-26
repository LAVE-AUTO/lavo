import { cookies, headers } from 'next/headers';
import { verifyJwt, extractBearerToken } from '@/lib/jwt';
import { findById } from '@/server/auth/user-repository';
import {
  successResponse,
  error401,
  error500,
} from '@/lib/responses';
import { ACCESS_COOKIE_NAME } from '@/helpers/constants';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/auth/me
 * Returns the authenticated user's profile.
 * Accepts token via Authorization: Bearer (preferred) or access_token cookie.
 *
 * Responses:
 *   200 { data: SafeUser }
 *   401 UNAUTHORIZED — missing or invalid token
 *   500 INTERNAL_ERROR
 */
export async function GET(): Promise<NextResponse> {
  const headersList = await headers();
  const bearerToken = extractBearerToken(headersList.get('authorization'));
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const token = bearerToken ?? cookieToken ?? null;

  if (!token) return applyNoStoreHeaders(error401());

  const payload = await verifyJwt(token);
  if (!payload) return applyNoStoreHeaders(error401('Session expired or invalid'));

  try {
    const user = await findById(payload.sub);
    if (!user) return applyNoStoreHeaders(error401('User not found'));

    return applyNoStoreHeaders(successResponse(user));
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}
