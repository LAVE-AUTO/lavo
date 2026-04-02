/**
 * POST /api/v1/me/device-token
 * Registers or updates the FCM push notification token for the authenticated client.
 * The token is upserted: if the token already exists for this user it is kept as-is;
 * if it is a new token it is inserted. Auth: client.
 */
import type { NextResponse } from 'next/server';

import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { mapZodErrors } from '@/validators/shared';
import { registerDeviceTokenBodySchema } from '@/validators/device-token';
import { upsertDeviceToken } from '@/server/notifications/device-token-service';


// %%%%% POST Handler %%%%%
// Register or update device token for authenticated client

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(
      error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)
    );
  }

  const parsed = registerDeviceTokenBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  const { token, platform } = parsed.data;

  try {
    await upsertDeviceToken(auth.sub, token, platform);
    return applyNoStoreHeaders(
      successResponse({ token, platform })
    );
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
