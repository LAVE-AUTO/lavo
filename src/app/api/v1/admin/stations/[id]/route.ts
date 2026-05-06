import { requireRole } from '@/lib/require-role';
import { getStationById } from '@/server/station/station-service';
import { updateStation } from '@/server/admin/admin-management-service';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import { adminStationIdParamSchema, mapZodErrors } from '@/validators/station';
import { updateStationAdminSchema } from '@/validators/admin-user';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';


// %%%%% Shared helpers %%%%%

/**
 * Resolves the dynamic [id] segment and validates it as a UUID.
 * Returns the parsed id string on success, or a ready-to-return NextResponse on failure.
 */
async function parseStationId(
  params: Promise<{ id: string }>
): Promise<string | NextResponse> {
  const { id } = await params;
  const parsed = adminStationIdParamSchema.safeParse({ id });
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Invalid station id', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }
  return parsed.data.id;
}

/**
 * Wraps the standard service-error → HTTP response mapping used by all handlers
 * in this route file.
 */
function handleServiceError(e: unknown): NextResponse {
  if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
  if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
  return applyNoStoreHeaders(error500(e));
}


// %%%%% END - Shared helpers %%%%%


// %%%%% Route handlers %%%%%

/**
 * GET /api/v1/admin/stations/:id
 * Returns full station details including submitted documents.
 * Stripe account id is stripped - not needed by the admin UI.
 *
 * Responses:
 *   200 { data: StationWithDocuments }
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(undefined, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const stationId = await parseStationId(params);
  if (stationId instanceof Response) return stationId;

  try {
    const raw = await getStationById(stationId);
    // Strip Stripe account id - reduces blast radius if this endpoint is ever misconfigured.
    // Rejection reason and approval metadata are intentionally retained for admin review.
    const { stripe_account_id: _stripe, ...station } = raw;
    return applyNoStoreHeaders(successResponse(station));
  } catch (e) {
    return handleServiceError(e);
  }
}


/**
 * PUT /api/v1/admin/stations/:id
 * Updates whitelisted fields on a station.
 * Logs the action in admin_logs with a full before/after snapshot.
 *
 * Role: admin only.
 *
 * Responses:
 *   200 { data: AdminStation }
 *   400 VALIDATION_FAILED  - invalid UUID param or body
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   404 NOT_FOUND          - station not found
 *   500 INTERNAL_ERROR
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const stationId = await parseStationId(params);
  if (stationId instanceof Response) return stationId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = updateStationAdminSchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    // updateStation returns with stripe_account_id and rejection_reason already stripped.
    const station = await updateStation(auth.sub, stationId, parsed.data);
    return applyNoStoreHeaders(successResponse(station, 'Station updated successfully'));
  } catch (e) {
    return handleServiceError(e);
  }
}


// %%%%% END - Route handlers %%%%%
