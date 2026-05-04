/**
 * PATCH /api/v1/me/notifications/:id/read — mark a single notification as read. Auth: client.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { readNotification } from '@/server/notifications/user-notifications-service';
import { AppError, NotFoundError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const paramsSchema = z.object({
  id: z.string().uuid('Invalid notification id'),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return applyNoStoreHeaders(error400('Invalid notification id', ApiCode.VALIDATION_FAILED));

  try {
    const notification = await readNotification(parsed.data.id, auth.sub);
    return applyNoStoreHeaders(successResponse(notification));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
