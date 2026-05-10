/**
 * PATCH /api/v1/me/profile
 * Updates the authenticated client's personal info (first_name, last_name, phone).
 * At least one field must be provided. Email is not editable via this endpoint.
 */

import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { updateProfileBodySchema, mapZodErrors } from '@/validators/auth';
import { updateProfile } from '@/server/auth/user-repository';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = updateProfileBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  // Build a whitelist payload from the parsed result. This is a defense-in-depth
  // step: even though the Zod schema strips unknown keys, we explicitly pick only
  // the editable fields so a future schema change cannot accidentally widen the
  // attack surface to fields like email, password_hash, or role.
  const safeData: { first_name?: string; last_name?: string; phone?: string } = {};
  if (parsed.data.first_name !== undefined) safeData.first_name = parsed.data.first_name;
  if (parsed.data.last_name !== undefined) safeData.last_name = parsed.data.last_name;
  if (parsed.data.phone !== undefined) safeData.phone = parsed.data.phone;

  try {
    const updated = await updateProfile(auth.sub, safeData);
    return applyNoStoreHeaders(successResponse({ user: updated }));
  } catch (e) {
    return applyNoStoreHeaders(error500(e));
  }
}
