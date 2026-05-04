import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { requireAuth } from '@/lib/require-auth';
import { findById, findByIdWithPassword, updateProfile, softDeleteUser } from '@/server/auth/user-repository';
import { revokeAllRefreshTokensForUser } from '@/server/auth/refresh-token-repository';
import {
  successResponse,
  error400,
  error401,
  error500,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/helpers/server-constants';
import { applyNoStoreHeaders } from '@/lib/response-headers';

const patchBodySchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().max(30).nullable().optional(),
});

const deleteBodySchema = z.object({
  current_password: z.string().min(1),
});

/**
 * GET /api/v1/auth/me — returns the authenticated user's profile.
 * PATCH /api/v1/auth/me — updates first_name, last_name, phone.
 * DELETE /api/v1/auth/me — RGPD soft-delete: anonymizes account, revokes tokens, clears cookies.
 *
 * Mutating methods go through `requireAuth(request)` so cookie-auth requests are protected
 * by the same-origin / X-Requested-With CSRF defense (see `assertSafeCookieAuthForMutation`).
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const user = await findById(auth.sub);
    if (!user) return applyNoStoreHeaders(error401('User not found'));
    return applyNoStoreHeaders(successResponse(user));
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));
  }

  try {
    const updated = await updateProfile(auth.sub, parsed.data);
    return applyNoStoreHeaders(successResponse(updated));
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));
  }

  try {
    const user = await findByIdWithPassword(auth.sub);
    if (!user) return applyNoStoreHeaders(error401('User not found'));

    // Reject re-delete on an already-deleted account: a still-valid (non-expired) access
    // token could otherwise be replayed to repeatedly mutate the soft-deleted email row.
    if (user.status === 'deleted') return applyNoStoreHeaders(error401('User not found'));

    const passwordMatches = await bcrypt.compare(parsed.data.current_password, user.password_hash ?? '');
    if (!passwordMatches) return applyNoStoreHeaders(error401('Incorrect password'));

    const emailHash = createHash('sha256').update(user.email).digest('hex');
    await softDeleteUser(auth.sub, emailHash);
    await revokeAllRefreshTokensForUser(auth.sub);

    const res = new NextResponse(null, { status: 204 });
    const cookieOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: 0, path: '/' };
    res.cookies.set(ACCESS_COOKIE_NAME, '', cookieOpts);
    res.cookies.set(REFRESH_COOKIE_NAME, '', cookieOpts);
    return res;
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}
