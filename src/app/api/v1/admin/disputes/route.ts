/**
 * @swagger
 * /admin/disputes:
 *   get:
 *     summary: List disputes (admin)
 *     description: >
 *       Returns a paginated, filterable list of all disputes across the platform.
 *       Admin role required.
 *     tags:
 *       - Disputes
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [open, refunded, resolved, rejected]
 *       - name: station_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: client_id
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *       - name: date_from
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: date_to
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
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
 *         description: Paginated list of disputes
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
 *                             $ref: '#/components/schemas/Dispute'
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
 *         description: Forbidden - admin role required
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
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { listDisputesQuerySchema, mapZodErrors } from '@/validators/dispute';
import { listDisputesAdmin } from '@/server/disputes/dispute-service';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/disputes
 * Returns a paginated, filterable list of disputes.
 *
 * Role: admin only.
 *
 * Query params:
 *   status       - open | refunded | resolved | rejected
 *   station_id   - filter by station UUID
 *   client_id    - filter by client UUID
 *   date_from    - ISO 8601 datetime (inclusive lower bound)
 *   date_to      - ISO 8601 datetime (inclusive upper bound)
 *   page         - page number (default 1)
 *   per_page     - items per page (default 20, max 100)
 *
 * Responses:
 *   200 { data: { items, meta } }
 *   400 VALIDATION_FAILED   - invalid query params
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // SECURITY: pass request so requireAuth reads headers for auth validation
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries());

  const parsed = listDisputesQuerySchema.safeParse(searchParams);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const result = await listDisputesAdmin(parsed.data);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    // SECURITY: never pass raw error to error500 - leaks internal details via _dev
    console.error('[GET /api/v1/admin/disputes] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
