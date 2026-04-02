/**
 * @swagger
 * /stations/queue/{queueId}/pick:
 *   post:
 *     summary: Pick a walk-in client from the queue
 *     description: >
 *       Station operator selects a queue entry to serve immediately.
 *       The entry moves from pending/late to in_progress and queue positions shift up.
 *       Typically used when a reserved slot becomes available.
 *     tags:
 *       - Queue
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: queueId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Queue entry UUID to pick
 *     responses:
 *       200:
 *         description: Entry picked and moved to in_progress
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         entry:
 *                           $ref: '#/components/schemas/Entry'
 *       400:
 *         description: Invalid queue entry ID
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
 *       403:
 *         description: No station associated with this account
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Queue entry not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Entry is not in a pickable state
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
import { successResponse, error400, error403, error404, error409, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { z } from 'zod';
import { mapZodErrors } from '@/validators/entry';
import { pickQueueEntry } from '@/server/reservations/queue-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError, ConflictError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

const queueIdParamSchema = z.object({
  queueId: z.string().uuid('Invalid queue entry id'),
});

type Params = { params: Promise<{ queueId: string }> };

export async function POST(_request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(_request, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  const station = await findStationByUserId(auth.sub);
  if (!station) return error403('No station associated with this account', ApiCode.FORBIDDEN);

  const { queueId } = await params;
  const parsed = queueIdParamSchema.safeParse({ queueId });
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const entry = await pickQueueEntry(station.id, parsed.data.queueId);
    return successResponse({ entry: serializeEntry(entry) });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ConflictError) return error409(e.message, ApiCode.CONFLICT);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
