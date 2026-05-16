/**
 * POST /api/v1/reservations/:id/reschedule
 * Client requests a slot change on their confirmed reservation. Auth: client.
 *
 * Body: exactly one of
 *   - { new_time_slot_id: string (uuid) }      // legacy: pre-generated slot
 *   - { new_start_time: string (ISO 8601) }    // modern per-post availability flow
 *
 * Response 201:
 *   {
 *     data: {
 *       is_late_cancellation,
 *       penalty_amount,
 *       refunded_amount,
 *       stripe_client_secret,  // present only when is_late_cancellation=true
 *       ...entry fields (includes id, status, time_slot_id, ...)
 *     }
 *   }
 *
 * Errors: 400 VALIDATION_FAILED, 401 UNAUTHORIZED, 404 NOT_FOUND,
 *         409 CONFLICT | SLOT_FULL, 500 INTERNAL_ERROR
 */
import { AppError, ConflictError, NotFoundError, SlotFullError } from '@/lib/errors';
import { requireRole } from '@/lib/require-role';
import { error400, error404, error409, error500, fromAppError, successResponse } from '@/lib/responses';
import { findEntryById } from '@/server/reservations/entry-repository';
import { rescheduleReservation, rescheduleReservationByStartTime } from '@/server/reservations/reschedule-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { findStationById } from '@/server/station/station-repository';
import { ApiCode } from '@/types/api-codes';
import { mapZodErrors, reservationIdParamSchema, rescheduleBodySchema } from '@/validators/entry';
import { HTTP_STATUS } from '@/helpers/constants';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  const { id } = await params;
  const paramParsed = reservationIdParamSchema.safeParse({ id });
  if (!paramParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(paramParsed.error));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }
  const bodyParsed = rescheduleBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(bodyParsed.error));
  }

  // Pre-flight: resolve reservation ownership and station in one pass.
  // The service re-reads both atomically inside its transaction; this read is only
  // to fail fast before acquiring any locks and to obtain the station's Stripe account id.
  const entry = await findEntryById(paramParsed.data.id);
  if (!entry || entry.user_id !== auth.sub) return error404('Reservation not found');

  const station = await findStationById(entry.station_id);
  if (!station || station.status !== 'active') return error404('Station not found or not active');
  if (!station.stripe_account_id) {
    return error409('Station has no payment account configured', ApiCode.CONFLICT);
  }

  try {
    const result = bodyParsed.data.new_start_time
      ? await rescheduleReservationByStartTime(
          paramParsed.data.id,
          auth.sub,
          bodyParsed.data.new_start_time,
          station.stripe_account_id,
        )
      : await rescheduleReservation(
          paramParsed.data.id,
          auth.sub,
          bodyParsed.data.new_time_slot_id!,
          station.stripe_account_id,
        );

    return successResponse(
      {
        is_late_cancellation: result.isLateCancellation,
        penalty_amount: result.penaltyAmount,
        refunded_amount: result.refundedAmount,
        ...(result.clientSecret !== null && { stripe_client_secret: result.clientSecret }),
        ...serializeEntry(result.newEntry),
      },
      undefined,
      HTTP_STATUS.CREATED
    );
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof SlotFullError) return error409(e.message, ApiCode.SLOT_FULL);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
