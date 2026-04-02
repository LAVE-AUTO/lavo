/**
 * @swagger
 * /station/delays:
 *   get:
 *     summary: List delay requests for the authenticated station
 *     description: >
 *       Returns paginated delay requests submitted by clients for reservations at
 *       the authenticated station. Filter by status for workflow views.
 *     tags:
 *       - Station
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, accepted, refused, all]
 *           default: all
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: per_page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated list of delay requests
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
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/DelayRequest'
 *                         meta:
 *                           $ref: '#/components/schemas/PaginationMeta'
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
 *       403:
 *         description: Forbidden — station role required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: No station associated with this account
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
import { z } from 'zod';
import type { NextResponse } from 'next/server';

import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { mapZodErrors } from '@/validators/shared';
import { findStationByUserId } from '@/server/station/station-repository';
import { listDelaysByStation } from '@/server/reservations/delay-service';


// %%%%% Validation %%%%%
// Query parameter schema for delay listing

const listDelaysQuerySchema = z.object({
  status: z.enum(['pending', 'accepted', 'refused', 'all']).optional().default('all'),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});


// %%%%% GET Handler %%%%%
// Retrieve paginated delay requests for authenticated station

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const { searchParams } = new URL(request.url);
  const parsed = listDelaysQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error)));
  }

  const { status, page, per_page } = parsed.data;

  try {
    const result = await listDelaysByStation(station.id, {
      status,
      page,
      perPage: per_page,
    });

    return applyNoStoreHeaders(
      successResponse({
        items: result.rows.map((r) => ({
          id: r.id,
          reservation_id: r.reservation_id,
          user_id: r.user_id,
          station_id: r.station_id,
          status: r.status,
          message: r.message,
          refusal_reason: r.refusal_reason,
          created_at: r.created_at,
          updated_at: r.updated_at,
          reservation: r.reservation
            ? {
                id: r.reservation.id,
                scheduled_at: r.reservation.scheduled_at,
                vehicle_format_id: r.reservation.vehicle_format_id,
              }
            : null,
        })),
        meta: {
          total: result.total,
          page: result.page,
          per_page: result.perPage,
        },
      })
    );
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[GET /api/v1/station/delays] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
