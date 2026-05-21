import { z } from 'zod';
import { requireRole } from '@/lib/require-role';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import {
  getAdminNotificationPrefs,
  getClientNotificationPrefs,
  patchAdminNotificationPrefs,
  patchClientNotificationPrefs,
} from '@/server/notifications/user-notification-prefs-repository';
import type { NextResponse } from 'next/server';

const patchSchema = z.object({
  wash_status: z.boolean().optional(),
  reminder: z.boolean().optional(),
  offers: z.boolean().optional(),
  review: z.boolean().optional(),
  station_lifecycle: z.object({
    in_app: z.boolean().optional(),
    push: z.boolean().optional(),
    email: z.boolean().optional(),
  }).optional(),
  kyc_alerts: z.object({
    in_app: z.boolean().optional(),
    push: z.boolean().optional(),
    email: z.boolean().optional(),
  }).optional(),
  support_alerts: z.object({
    in_app: z.boolean().optional(),
    push: z.boolean().optional(),
    email: z.boolean().optional(),
  }).optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client', 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const prefs = auth.role === 'admin'
      ? await getAdminNotificationPrefs(auth.sub)
      : await getClientNotificationPrefs(auth.sub);
    return applyNoStoreHeaders(successResponse(prefs));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client', 'admin');
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
    const prefs = auth.role === 'admin'
      ? await patchAdminNotificationPrefs(auth.sub, {
          station_lifecycle: parsed.data.station_lifecycle,
          kyc_alerts: parsed.data.kyc_alerts,
          support_alerts: parsed.data.support_alerts,
        })
      : await patchClientNotificationPrefs(auth.sub, {
          wash_status: parsed.data.wash_status,
          reminder: parsed.data.reminder,
          offers: parsed.data.offers,
          review: parsed.data.review,
        });
    return applyNoStoreHeaders(successResponse(prefs));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
