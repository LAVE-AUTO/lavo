/**
 * POST /api/v1/stations/:id/queue/join
 * Join the walk-in queue at the station. Auth: client. Body: vehicle_format_id.
 * No payment required — walk-in queue is free of charge.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { joinQueueBodySchema, mapZodErrors as mapEntryZodErrors } from '@/validators/entry';
import { joinQueue } from '@/server/reservations/queue-service';
import { findStationById } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('client');
  if (auth instanceof Response) return auth as NextResponse;

  const { id: stationId } = await params;
  const paramParsed = stationIdParamSchema.safeParse({ id: stationId });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }
  const bodyParsed = joinQueueBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapEntryZodErrors(bodyParsed.error));
  }

  const station = await findStationById(paramParsed.data.id);
  if (!station || station.status !== 'active') return error404('Station not found or not active');

  try {
    const entry = await joinQueue(auth.sub, paramParsed.data.id, bodyParsed.data.vehicle_format_id);
    return successResponse(serializeEntry(entry), undefined, 201);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

