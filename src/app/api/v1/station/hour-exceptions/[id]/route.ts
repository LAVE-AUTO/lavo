/**
 * DELETE /api/v1/station/hour-exceptions/:id — remove an exception date. Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { removeStationHourException } from '@/server/station/station-hours-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { AppError, NotFoundError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const paramsSchema = z.object({
  id: z.string().uuid('Invalid exception id'),
});

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return applyNoStoreHeaders(error400('Invalid exception id', ApiCode.VALIDATION_FAILED));

  try {
    await removeStationHourException(station.id, parsed.data.id);
    return applyNoStoreHeaders(successResponse(null));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
