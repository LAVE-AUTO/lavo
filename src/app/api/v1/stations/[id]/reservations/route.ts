/**
 * @swagger
 * /stations/{id}/reservations:
 *   post:
 *     summary: Create a reservation at a station
 *     description: >
 *       Books a specific time slot at the given station.
 *       Returns a Stripe client secret for payment confirmation on the frontend.
 *       The reservation status becomes "confirmed" after the Stripe webhook confirms payment.
 *     tags:
 *       - Reservations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Station UUID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - time_slot_id
 *               - vehicle_format_id
 *             properties:
 *               time_slot_id:
 *                 type: string
 *                 format: uuid
 *               vehicle_format_id:
 *                 type: string
 *                 format: uuid
 *               qr_token:
 *                 type: string
 *                 description: Optional QR code token for on-site booking.
 *               v:
 *                 type: integer
 *                 description: QR token version.
 *     responses:
 *       201:
 *         description: Reservation created, awaiting payment
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       allOf:
 *                         - $ref: '#/components/schemas/Entry'
 *                         - type: object
 *                           properties:
 *                             reservation_id:
 *                               type: string
 *                               format: uuid
 *                             stripe_client_secret:
 *                               type: string
 *       400:
 *         description: Validation failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Station not found or not active
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Slot full or an active reservation already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error409, error429, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { createReservationBodySchema, mapZodErrors as mapEntryZodErrors } from '@/validators/entry';
import { createReservation, createReservationByStartTime } from '@/server/reservations/reservation-service';
import { findStationById } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import {
  AppError,
  ConflictError,
  NotFoundError,
  SlotFullError,
  ActiveReservationExistsError,
  ValidationError,
} from '@/lib/errors';
import type { NextResponse } from 'next/server';

// 5 réservations par minute par utilisateur — bloque le slot flooding sans gêner l'usage normal.
const reservationLimiter = createEndpointRateLimiter({ maxRequests: 5, windowMs: 60_000 });

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  if (reservationLimiter.isRateLimited(auth.sub)) return error429();

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
    /* Two booking modes:
     *   - legacy: client picks a pre-generated time_slot_id
     *   - new:    client picks a start_time computed via the per-post
     *             availability endpoint; server picks the bay & creates the slot
     * The validator already enforces exactly one of the two is supplied. */
    const { entry, clientSecret } = bodyParsed.data.start_time
      ? await createReservationByStartTime(
          auth.sub,
          paramParsed.data.id,
          station.stripe_account_id,
          bodyParsed.data.start_time,
          bodyParsed.data.service_id,
          bodyParsed.data.vehicle_format_id ?? null,
          {
            qrToken: bodyParsed.data.qr_token,
            qrVersion: bodyParsed.data.v,
          }
        )
      : await createReservation(
          auth.sub,
          paramParsed.data.id,
          station.stripe_account_id,
          bodyParsed.data.time_slot_id!,
          bodyParsed.data.service_id,
          bodyParsed.data.vehicle_format_id ?? null,
          {
            qrToken: bodyParsed.data.qr_token,
            qrVersion: bodyParsed.data.v,
          }
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
    if (e instanceof ValidationError) return error400(e.message, ApiCode.VALIDATION_FAILED);
    if (e instanceof ActiveReservationExistsError) return error409(e.message, ApiCode.ACTIVE_RESERVATION_EXISTS);
    if (e instanceof SlotFullError) return error409(e.message, ApiCode.SLOT_FULL);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    console.error('[CREATE_RESERVATION] Unexpected error', {
      stationId: paramParsed.data.id,
      userId: auth.sub,
      error: e instanceof Error ? { message: e.message, stack: e.stack } : String(e),
    });
    return error500(e);
  }
}
