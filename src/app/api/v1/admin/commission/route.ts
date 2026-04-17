import { requireRole } from '@/lib/require-role';
import {
  successResponse,
  error400,
  error500,
  fromAppError,
} from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { AppError } from '@/lib/errors';
import { updateCommissionSchema, mapZodErrors } from '@/validators/commission';
import { getCurrentCommission, updateCommission } from '@/server/admin/commission-service';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/admin/commission
 * Returns the currently active commission rate with its context (set_by, effective_at, previous_rate).
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: { rate, previous_rate, effective_at, set_by } }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: Request) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const commission = await getCurrentCommission();
    return applyNoStoreHeaders(successResponse(commission));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

/**
 * PUT /api/v1/admin/commission
 * Sets a new commission rate. Creates an immutable history entry — past rates are never altered.
 * The new rate applies immediately to all subsequent transactions.
 *
 * Role: admin only.
 *
 * Body: { rate: number }  — decimal fraction, e.g. 0.1 for 10%
 *
 * Responses:
 *   200 { data: CommissionRow }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function PUT(request: Request) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = updateCommissionSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const entry = await updateCommission(auth.sub, parsed.data.rate);
    return applyNoStoreHeaders(successResponse(entry, 'Commission rate updated successfully'));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
