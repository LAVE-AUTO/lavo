/**
 * @swagger
 * /admin/disputes/{id}/refund:
 *   post:
 *     summary: Issue a Stripe refund for a dispute (admin)
 *     description: >
 *       Issues a Stripe refund for the reservation attached to an open dispute.
 *       Blocked if a Stripe transfer to the station already occurred.
 *       Omit amount for a full refund. Admin role required.
 *       Rate-limited to 10 requests per minute per admin.
 *     tags:
 *       - Disputes
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Dispute UUID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *                 description: >
 *                   Partial refund amount in EUR. Omit for a full refund.
 *                 minimum: 0.01
 *     responses:
 *       200:
 *         description: Refund issued successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Dispute'
 *       400:
 *         description: Validation failed or refund not eligible
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
 *       404:
 *         description: Dispute or reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: Dispute is already closed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       429:
 *         description: Too many requests
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
import {
  successResponse,
  error400,
  error404,
  error409,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, DisputeAlreadyClosedError } from '@/lib/errors';
import { disputeIdParamSchema, refundDisputeSchema, mapZodErrors } from '@/validators/dispute';
import { refundDispute } from '@/server/disputes/dispute-service';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import type { NextResponse } from 'next/server';

// SECURITY: rate-limit refund actions to 10 per minute per admin
const refundLimiter = createEndpointRateLimiter({ maxRequests: 10, windowMs: 60_000 });

/**
 * POST /api/v1/admin/disputes/:id/refund
 * Issues a Stripe refund for an open dispute.
 * Blocked if a Stripe transfer to the station has already been made.
 *
 * Role: admin only.
 *
 * Body:
 *   amount? (number) - partial refund amount in EUR; omit for full refund
 *
 * Responses:
 *   200 { data: Dispute }
 *   400 VALIDATION_FAILED   - invalid param or body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND           - dispute or reservation not found
 *   409 DISPUTE_ALREADY_CLOSED - dispute is not open
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  if (refundLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  const { id } = await params;
  const idResult = disputeIdParamSchema.safeParse(id);
  if (!idResult.success) {
    return applyNoStoreHeaders(error400('Invalid dispute ID format', ApiCode.VALIDATION_FAILED));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = refundDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const dispute = await refundDispute(auth.sub, idResult.data, parsed.data);
    return applyNoStoreHeaders(successResponse(dispute, 'Dispute refunded successfully'));
  } catch (e) {
    if (e instanceof DisputeAlreadyClosedError) {
      return applyNoStoreHeaders(error409(e.message, ApiCode.DISPUTE_ALREADY_CLOSED));
    }
    if (e instanceof AppError && e.statusCode === 404) {
      return applyNoStoreHeaders(error404(e.message));
    }
    if (e instanceof AppError) {
      console.error(`[POST /api/v1/admin/disputes/:id/refund] AppError ${e.statusCode}:`, e.message);
      return applyNoStoreHeaders(fromAppError(e));
    }
    // SECURITY: never pass raw error to error500
    console.error('[POST /api/v1/admin/disputes/:id/refund] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
