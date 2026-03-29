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
 *   status  — "resolved" | "rejected"
 *   reason  — closing reason (required)
 *
 * Responses:
 *   200 { data: Dispute }
 *   400 VALIDATION_FAILED     — invalid param or body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND             — dispute not found
 *   409 DISPUTE_ALREADY_CLOSED — dispute is not open
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
