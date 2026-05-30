/**
 * @swagger
 * /me/entries/{entryId}/upgrade-to-reservation:
 *   post:
 *     summary: Upgrade a queue entry to a paid reservation
 *     description: >
 *       Upgrades a walk-in queue entry to a time-slot reservation.
 *       Returns a Stripe client secret for frontend payment confirmation.
 *       The reservation is confirmed when the Stripe webhook reports payment success.
 *     tags:
 *       - Queue
 *       - Reservations
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: entryId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Queue entry UUID to upgrade
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - time_slot_id
 *             properties:
 *               time_slot_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Entry upgraded, Stripe client secret returned
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
 *         description: Entry or station not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Slot full or entry not eligible for upgrade
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
import { successResponse, error400, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { entryIdParamSchema, upgradeToReservationBodySchema, mapZodErrors } from '@/validators/entry';
import { upgradeQueueToReservation, upgradeQueueToReservationByStartTime } from '@/server/reservations/reservation-service';
import { findEntryByIdAndUser } from '@/server/reservations/entry-repository';
import { findStationById } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError, SlotFullError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
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
    const { entry: upgraded, clientSecret } = bodyParsed.data.start_time
      ? await upgradeQueueToReservationByStartTime(
          paramParsed.data.entryId,
          auth.sub,
          bodyParsed.data.start_time,
          entry.station_id,
          station.stripe_account_id
        )
      : await upgradeQueueToReservation(
          paramParsed.data.entryId,
          auth.sub,
          bodyParsed.data.time_slot_id!,
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
    if (e instanceof SlotFullError) return error409(e.message, ApiCode.SLOT_FULL);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
