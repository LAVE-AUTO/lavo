/**
 * POST /api/v1/stations/queue/:queueId/pick
 * Station selects a walk-in client from the queue to serve immediately. Auth: station.
 * The client's entry moves from pending/late to in_progress; queue positions shift up.
 * Typically used when a reserved slot becomes available due to a late client.
 *
 * Response 200: { data: { entry } }
 * Errors: 400 VALIDATION_FAILED, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND, 409 CONFLICT, 500 INTERNAL_ERROR
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error403, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { z } from 'zod';
import { mapZodErrors } from '@/validators/entry';
import { pickQueueEntry } from '@/server/reservations/queue-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

const queueIdParamSchema = z.object({
  queueId: z.string().uuid('Invalid queue entry id'),
});

type Params = { params: Promise<{ queueId: string }> };

export async function POST(_request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(_request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error403('No station associated with this account', ApiCode.FORBIDDEN);

  const { queueId } = await params;
  const parsed = queueIdParamSchema.safeParse({ queueId });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const entry = await pickQueueEntry(station.id, parsed.data.queueId);
    return successResponse({ entry: serializeEntry(entry) });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
