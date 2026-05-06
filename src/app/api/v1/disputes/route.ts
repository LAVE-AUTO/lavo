/**
 * @swagger
 * /disputes:
 *   post:
 *     summary: Open a dispute for a completed reservation
 *     description: >
 *       Opens a dispute on behalf of the authenticated client for a reservation that
 *       has been completed and paid. Only one dispute per reservation is allowed.
 *       Rate-limited to 5 requests per minute per user.
 *     tags:
 *       - Disputes
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reservation_id
 *               - reason
 *             properties:
 *               reservation_id:
 *                 type: string
 *                 format: uuid
 *               reason:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *     responses:
 *       201:
 *         description: Dispute created successfully
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
 *         description: Reservation does not belong to client
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       404:
 *         description: Reservation not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorEnvelope'
 *       409:
 *         description: A dispute already exists for this reservation
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
  error409,
  error429,
  error500,
  fromAppError,
} from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { createDisputeSchema, mapZodErrors } from '@/validators/dispute';
import { createDispute } from '@/server/disputes/dispute-service';
import { createEndpointRateLimiter } from '@/lib/endpoint-rate-limiter';
import type { NextResponse } from 'next/server';

// SECURITY: rate-limit dispute creation to 5 requests per minute per user
const disputeCreateLimiter = createEndpointRateLimiter({ maxRequests: 5, windowMs: 60_000 });

/**
 * POST /api/v1/disputes
 * Opens a dispute for a completed, paid reservation.
 *
 * Role: client only.
 *
 * Responses:
 *   201 { data: Dispute }
 *   400 VALIDATION_FAILED   - invalid body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN           - reservation does not belong to the client or password change required
 *   404 NOT_FOUND           - reservation not found
 *   409 DISPUTE_ALREADY_EXISTS - a dispute already exists for this reservation
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

  if (disputeCreateLimiter.isRateLimited(auth.sub)) {
    return applyNoStoreHeaders(error429());
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = createDisputeSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const dispute = await createDispute(auth.sub, parsed.data);
    return applyNoStoreHeaders(successResponse(dispute, 'Dispute created successfully', 201));
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 409) {
      return applyNoStoreHeaders(error409(e.message, ApiCode.DISPUTE_ALREADY_EXISTS));
    }
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    // SECURITY: never pass raw error to error500 - leaks internal details via _dev
    console.error('[POST /api/v1/disputes] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
