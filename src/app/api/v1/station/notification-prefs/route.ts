/**
 * GET   /api/v1/station/notification-prefs - get notification preferences. Auth: station.
 * PATCH /api/v1/station/notification-prefs - merge-update notification preferences. Auth: station.
 *
 * PATCH body: arbitrary JSON object (key/value pairs are shallow-merged into stored prefs).
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId, getNotificationPrefs, patchNotificationPrefs } from '@/server/station/station-repository';
import { AppError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

// Cap the number of keys to prevent unbounded growth of the jsonb column.
// notification_prefs is a free-form bag, but a reasonable upper bound (50 keys) keeps
// the merged document small and avoids resource-exhaustion writes.
const MAX_PREF_KEYS = 50;
const patchBodySchema = z
  .record(z.unknown())
  .refine((obj) => Object.keys(obj).length <= MAX_PREF_KEYS, {
    message: `notification_prefs cannot have more than ${MAX_PREF_KEYS} keys`,
  });

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  try {
    const prefs = await getNotificationPrefs(station.id);
    return applyNoStoreHeaders(successResponse(prefs ?? {}));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const prefs = await patchNotificationPrefs(station.id, parsed.data);
    return applyNoStoreHeaders(successResponse(prefs));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
