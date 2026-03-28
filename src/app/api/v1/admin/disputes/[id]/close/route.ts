import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error404,
  error409,
  error500,
  fromAppError,
} from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError, DisputeAlreadyClosedError } from '@/lib/errors';
import { disputeIdParamSchema, closeDisputeSchema, mapZodErrors } from '@/validators/dispute';
import { closeDispute } from '@/server/disputes/dispute-service';
import type { NextResponse } from 'next/server';

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
    return applyNoStoreHeaders(error500(e));
  }
}
