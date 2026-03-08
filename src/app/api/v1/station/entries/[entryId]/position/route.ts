/**
 * PATCH /api/v1/station/entries/:entryId/position
 * Reorder queue: set queue_position for a queue entry. Auth: station.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, stationPatchPositionBodySchema, mapZodErrors } from '@/validators/entry';
import { findStationByUserId } from '@/server/station/station-repository';
import { updateEntryPosition } from '@/server/reservations/queue-service';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error404('No station associated with this account');

  const { entryId } = await params;
  const paramParsed = entryIdParamSchema.safeParse({ entryId });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }
  const bodyParsed = stationPatchPositionBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  try {
    const entry = await updateEntryPosition(
      paramParsed.data.entryId,
      station.id,
      bodyParsed.data.queue_position
    );
    return successResponse(serializeEntry(entry));
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

function serializeEntry(entry: {
  id: string;
  entry_type: string;
  queue_position: number | null;
  station_id: string;
  vehicle_format_id: string;
  status: string;
  amount_paid: string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: entry.id,
    entry_type: entry.entry_type,
    queue_position: entry.queue_position,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}
