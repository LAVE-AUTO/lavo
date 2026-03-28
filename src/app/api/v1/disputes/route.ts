import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error409,
  error500,
  fromAppError,
} from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { createDisputeSchema, mapZodErrors } from '@/validators/dispute';
import { createDispute } from '@/server/disputes/dispute-service';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/disputes
 * Opens a dispute for a completed, paid reservation.
 *
 * Role: client only.
 *
 * Responses:
 *   201 { data: Dispute }
 *   400 VALIDATION_FAILED   — invalid body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN           — reservation does not belong to the client or password change required
 *   404 NOT_FOUND           — reservation not found
 *   409 DISPUTE_ALREADY_EXISTS — a dispute already exists for this reservation
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return auth as NextResponse;

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
    return applyNoStoreHeaders(error500(e));
  }
}
