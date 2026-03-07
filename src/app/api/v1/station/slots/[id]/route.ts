/**
 * DELETE /api/v1/station/slots/:id
 * Deletes a time slot. Auth STATION. Slot must belong to station and have no reservations.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { deleteSlot } from '@/server/station/slot-service';
import { slotIdParamSchema, mapZodErrors } from '@/validators/station';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('station');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const parsed = slotIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  try {
    await deleteSlot(station.id, parsed.data.id);
    return successResponse({ deleted: true });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
