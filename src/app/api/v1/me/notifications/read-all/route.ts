/**
 * PATCH /api/v1/me/notifications/read-all - mark all unread notifications as read. Auth: client|station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { readAllNotifications } from '@/server/notifications/user-notifications-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client', 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const updated = await readAllNotifications(auth.sub);
    return applyNoStoreHeaders(successResponse({ updated }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
