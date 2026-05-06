/**
 * GET /api/v1/me/notifications/unread-count - count of unread notifications. Auth: client.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getUnreadCount } from '@/server/notifications/user-notifications-service';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const count = await getUnreadCount(auth.sub);
    return applyNoStoreHeaders(successResponse({ unread_count: count }));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
