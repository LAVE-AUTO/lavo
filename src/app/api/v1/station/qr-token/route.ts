import { requireRole } from '@/lib/require-role';
import { successResponse, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, ForbiddenError, NotFoundError } from '@/lib/errors';
import type { NextResponse } from 'next/server';
import { getMyStation } from '@/server/station/station-service';
import { generateQrToken, QR_TOKEN_VERSION } from '@/server/qr/qr-token-service';

/**
 * GET /api/v1/station/qr-token
 * Returns a signed QR token for the authenticated station.
 */
export async function GET() {
  const auth = await requireRole(undefined, 'station');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const station = await getMyStation(auth.sub);
    return successResponse({
      station_id: station.id,
      qr_token: generateQrToken(station.id),
      v: QR_TOKEN_VERSION,
    });
  } catch (e) {
    if (e instanceof NotFoundError) return error404(e.message);
    if (e instanceof ForbiddenError) return error403(e.message);
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
