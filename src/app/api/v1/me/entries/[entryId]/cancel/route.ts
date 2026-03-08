/**
 * PATCH /api/v1/me/entries/:entryId/cancel
 * Cancel a reservation or leave the queue. Auth: user.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, mapZodErrors } from '@/validators/entry';
import { cancelEntry } from '@/server/reservations/reservation-service';
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
    return successResponse({ entry: serializeEntry(entry) });
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
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string;
  status: string;
  queue_position: number | null;
  amount_paid: string;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: entry.id,
    entry_type: entry.entry_type,
    time_slot_id: entry.time_slot_id,
    station_id: entry.station_id,
    vehicle_format_id: entry.vehicle_format_id,
    status: entry.status,
    queue_position: entry.queue_position,
    amount_paid: entry.amount_paid,
    created_at: entry.created_at,
    updated_at: entry.updated_at,
  };
}
