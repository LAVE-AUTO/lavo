import { requireRole } from '@/lib/require-role';
import { successResponse, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';
import { getMyStation } from '@/server/station/station-service';
import { buildStationQrResolverUrl, generateQrToken, QR_TOKEN_VERSION } from '@/server/qr/qr-token-service';

/**
 * Returns the canonical QR payload for the authenticated station
 *
 * Authenticates the station account, loads its station record, and returns the
 * deterministic QR token, version marker, and canonical resolver URL used by
 * dashboards and poster generation flows. The endpoint intentionally exposes
 * both the raw token and the final URL so UI layers can reuse either form.
 *
 * @param {Request} request - Incoming authenticated station request
 * @returns {Promise<NextResponse>} Success response with `station_id`, `qr_token`, `v`, and `qr_url`, or an error response
 * @throws {None} Domain and infrastructure errors are converted into HTTP responses
 *
 * @example
 * const response = await GET(new Request('https://app.example.com/api/v1/station/qr-token'));
 *
 * @example
 * const response = await GET(request);
 *
 * @example
 * const response = await GET(requestWithoutStationAccess);
 */
export async function GET(request: Request) {
  const auth = await requireRole(undefined, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await getMyStation(auth.sub);
    return applyNoStoreHeaders(successResponse({
      station_id: station.id,
      qr_token: generateQrToken(station.id),
      v: QR_TOKEN_VERSION,
      qr_url: buildStationQrResolverUrl({
        origin: new URL(request.url).origin,
        stationId: station.id,
      }),
    }));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof ForbiddenError) return applyNoStoreHeaders(error403(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
