/**
 * GET /api/v1/me/notifications — list notifications (cursor-paginated). Auth: client.
 *
 * Query: limit (1-100, default 20), cursor (opaque string), unread_only (boolean)
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { getMyNotifications } from '@/server/notifications/user-notifications-service';
import { AppError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
  unread_only: z.string().optional().transform((v) => v === 'true'),
});

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const result = await getMyNotifications(auth.sub, {
      limit: parsed.data.limit,
      cursor: parsed.data.cursor,
      unread_only: parsed.data.unread_only,
    });
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
