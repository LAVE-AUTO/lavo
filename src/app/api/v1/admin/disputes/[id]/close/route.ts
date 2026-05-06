/**
 * @swagger
 * /admin/disputes/{id}/close:
 *   post:
 *     summary: Close a dispute without refund (admin)
 *     description: >
 *       Closes an open dispute as resolved or rejected without issuing a refund.
 *       Admin role required. Rate-limited to 20 requests per minute per admin.
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
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *               - reason
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [resolved, rejected]
 *               reason:
 *                 type: string
 *                 minLength: 1
 *     responses:
 *       200:
 *         description: Dispute closed successfully
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
 *       404:
 *         description: Dispute not found
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
import { disputeIdParamSchema, closeDisputeSchema, mapZodErrors } from '@/validators/dispute';
import { closeDispute } from '@/server/disputes/dispute-service';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import type { NextResponse } from 'next/server';

// SECURITY: rate-limit close actions to 20 per minute per admin
const closeLimiter = createEndpointRateLimiter({ maxRequests: 20, windowMs: 60_000 });

/**
 * POST /api/v1/admin/disputes/:id/close
 * Closes an open dispute as resolved or rejected (no refund).
 *
 * Role: admin only.
 *
 * Body:
 *   status  - "resolved" | "rejected"
 *   reason  - closing reason (required)
 *
 * Responses:
 *   200 { data: Dispute }
 *   400 VALIDATION_FAILED     - invalid param or body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND             - dispute not found
 *   409 DISPUTE_ALREADY_CLOSED - dispute is not open
 *   500 INTERNAL_ERROR
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  if (closeLimiter.isRateLimited(auth.sub)) {
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
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = closeDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const dispute = await closeDispute(auth.sub, idResult.data, parsed.data);
    return applyNoStoreHeaders(successResponse(dispute, 'Dispute closed successfully'));
  } catch (e) {
    if (e instanceof DisputeAlreadyClosedError) {
      return applyNoStoreHeaders(error409(e.message, ApiCode.DISPUTE_ALREADY_CLOSED));
    }
    if (e instanceof AppError && e.statusCode === 404) {
      return applyNoStoreHeaders(error404(e.message));
    }
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    // SECURITY: never pass raw error to error500
    console.error('[POST /api/v1/admin/disputes/:id/close] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
