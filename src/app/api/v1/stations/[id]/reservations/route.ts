/**
 * POST /api/v1/stations/:id/reservations
 * Create a reservation for the station. Auth: client. Body: time_slot_id, vehicle_format_id.
 * Returns reservation_id + stripe_client_secret for frontend payment confirmation.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { createReservationBodySchema, mapZodErrors as mapEntryZodErrors } from '@/validators/entry';
import { createReservation } from '@/server/reservations/reservation-service';
import { findStationById } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError, SlotFullError, ActiveReservationExistsError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
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
  const bodyParsed = createReservationBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapEntryZodErrors(bodyParsed.error));
  }

  const station = await findStationById(paramParsed.data.id);
  if (!station || station.status !== 'active') return error404('Station not found or not active');
  if (!station.stripe_account_id) return error409('Station has no payment account configured', ApiCode.CONFLICT);

  try {
    const { entry, clientSecret } = await createReservation(
      auth.sub,
      paramParsed.data.id,
      station.stripe_account_id,
      bodyParsed.data.time_slot_id,
      bodyParsed.data.vehicle_format_id
    );
    return successResponse(
      {
        reservation_id: entry.id,
        stripe_client_secret: clientSecret,
        ...serializeEntry(entry),
      },
      undefined,
      201
    );
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ActiveReservationExistsError) return error409(e.message, ApiCode.ACTIVE_RESERVATION_EXISTS);
    if (e instanceof SlotFullError) return error409(e.message, ApiCode.SLOT_FULL);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
