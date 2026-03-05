import { requireAuth } from '@/lib/require-auth';
import { submitStationDocuments } from '@/server/station/station-service';
import { stationDocumentsSchema, mapZodErrors } from '@/validators/station';
import {
  successResponse,
  error400,
  error403,
  error404,
  error500,
  fromAppError,
} from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/stations/onboarding/documents
 * Step 3 — Upload documents and accept terms.
 * Moves station status to pending_admin_validation.
 *
 * Body: { documents: [{ document_type, file_url }], terms_accepted: true }
 *
 * Responses:
 *   200 { message, data: Station }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND — step 2 not completed
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth as NextResponse;

  if (auth.role !== 'station') {
    return error403('Only station accounts can access this endpoint');
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return error400('Invalid JSON body', ApiCode.VALIDATION_FAILED);
  }

  const parsed = stationDocumentsSchema.safeParse(body);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }

  try {
    const station = await submitStationDocuments(auth.sub, parsed.data);
    return successResponse(station, 'Documents submitted. Your application is under review.');
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ForbiddenError) return error403(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
