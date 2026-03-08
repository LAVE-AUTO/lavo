/**
 * PATCH /api/v1/me/entries/:entryId/cancel
 * Cancel a reservation or leave the queue. Auth: user.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, mapZodErrors } from '@/validators/entry';
import { cancelEntry } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function PATCH(_request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('user');
  if (auth instanceof Response) return auth as NextResponse;

  const { entryId } = await params;
  const parsed = entryIdParamSchema.safeParse({ entryId });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const entry = await cancelEntry(parsed.data.entryId, auth.sub);
    return successResponse(serializeEntry(entry));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

