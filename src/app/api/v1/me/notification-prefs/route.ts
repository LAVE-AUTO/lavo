import { z } from 'zod';
import { requireRole } from '@/lib/require-role';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import {
  getClientNotificationPrefs,
  patchClientNotificationPrefs,
} from '@/server/notifications/user-notification-prefs-repository';
import type { NextResponse } from 'next/server';

const patchSchema = z.object({
  wash_status: z.boolean().optional(),
  reminder: z.boolean().optional(),
  offers: z.boolean().optional(),
  review: z.boolean().optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const prefs = await getClientNotificationPrefs(auth.sub);
    return applyNoStoreHeaders(successResponse(prefs));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const prefs = await patchClientNotificationPrefs(auth.sub, parsed.data);
    return applyNoStoreHeaders(successResponse(prefs));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
