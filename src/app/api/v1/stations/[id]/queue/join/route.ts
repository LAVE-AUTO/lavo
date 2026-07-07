/**
 * @swagger
 * /stations/{id}/queue/join:
 *   post:
 *     summary: Join the walk-in queue at a station
 *     description: >
 *       Adds the authenticated client to the walk-in queue at the given station.
 *       A Stripe PaymentIntent is created immediately for the queue entry; the payload
 *       returns `client_secret` so the frontend can confirm the payment before the
 *       station serves the client via POST /stations/queue/:queueId/pick.
 *     tags:
 *       - Queue
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
 *               - vehicle_format_id
 *             properties:
 *               vehicle_format_id:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Successfully joined the queue
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Entry'
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
 *         description: Station is closed for walk-ins or client already in queue
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
import { stationIdParamSchema, mapZodErrors } from '@/validators/station';
import { joinQueueBodySchema, mapZodErrors as mapEntryZodErrors } from '@/validators/entry';
import { joinQueue } from '@/server/reservations/queue-service';
import { findStationById } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
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
  const bodyParsed = joinQueueBodySchema.safeParse(body);
  if (!bodyParsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapEntryZodErrors(bodyParsed.error));
  }

  const station = await findStationById(paramParsed.data.id);
  if (!station || station.status !== 'active') return error404('Station not found or not active');
  if (!station.is_open) return error409('Station is currently closed for walk-ins', ApiCode.CONFLICT);
  if (!station.stripe_account_id) return error409('Station payment not configured', ApiCode.CONFLICT);

  try {
    const { entry, clientSecret } = await joinQueue(auth.sub, paramParsed.data.id, bodyParsed.data.service_id, bodyParsed.data.vehicle_format_id ?? null, station.stripe_account_id);
    return successResponse({ ...serializeEntry(entry), client_secret: clientSecret }, undefined, 201);
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
