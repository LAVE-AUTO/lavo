/**
 * POST /api/v1/me/entries/:entryId/upgrade-to-reservation
 * Upgrade a queue entry to a reservation by booking a specific time slot. Auth: client.
 * Body: { time_slot_id: UUID }
 *
 * Creates a Stripe PaymentIntent (manual capture) and returns the client_secret
 * for the frontend to complete payment. On successful payment, the webhook confirms
 * the reservation (status: confirmed).
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, upgradeToReservationBodySchema, mapZodErrors } from '@/validators/entry';
import { upgradeQueueToReservation } from '@/server/reservations/reservation-service';
import { findEntryByIdAndUser } from '@/server/reservations/entry-repository';
import { findStationById } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole('client');
  if (auth instanceof Response) return auth as NextResponse;

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
  const bodyParsed = upgradeToReservationBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  const entry = await findEntryByIdAndUser(paramParsed.data.entryId, auth.sub);
  if (!entry) return error404('Entry not found');

  const station = await findStationById(entry.station_id);
  if (!station || station.status !== 'active') return error404('Station not found or not active');
  if (!station.stripe_account_id) {
    return error409('Station has no payment account configured', ApiCode.CONFLICT);
  }

  try {
    const { entry: upgraded, clientSecret } = await upgradeQueueToReservation(
      paramParsed.data.entryId,
      auth.sub,
      bodyParsed.data.time_slot_id,
      entry.station_id,
      station.stripe_account_id
    );
    return successResponse(
      {
        reservation_id: upgraded.id,
        stripe_client_secret: clientSecret,
        ...serializeEntry(upgraded),
      },
      undefined,
      201
    );
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) {
      const code = e.message.includes('full')
        ? ApiCode.SLOT_FULL
        : ApiCode.CONFLICT;
      return error409(e.message, code);
    }
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
