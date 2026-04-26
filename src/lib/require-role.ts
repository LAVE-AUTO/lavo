import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations } from '@/lib/db/schema';
import { requireAuth } from '@/lib/require-auth';
import { error403 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import type { JwtPayload } from '@/lib/jwt';
import type { NextResponse } from 'next/server';

/**
 * Role-based guard for protected route handlers.
 * Verifies authentication then checks that the caller has one of the allowed roles.
 *
 * For station role: verifies the station account exists and is not blocked.
 * Pending KYC (`pending_admin_validation`) is allowed so station owners can configure
 * their workspace before final validation.
 * For any role: if force_password_change is true, returns 403 PASSWORD_CHANGE_REQUIRED.
 *
 * Usage:
 *   const result = await requireRole(request, 'admin');
 *   if (result instanceof NextResponse) return result;
 *   const { sub, role } = result;
 *
 * For GET handlers without a Request in scope, pass `undefined` as the first argument.
 */
export async function requireRole(
  request: Request | undefined,
  ...allowedRoles: string[]
): Promise<JwtPayload | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth as NextResponse;

  // Block access until password is changed
  if (auth.force_password_change) {
    return error403(
      'You must change your password before continuing',
      ApiCode.PASSWORD_CHANGE_REQUIRED
    );
  }

  if (!allowedRoles.includes(auth.role)) {
    return error403('Forbidden');
  }

  // For station accounts, ensure the station exists and is not blocked.
  // Pending KYC is intentionally allowed for station-side configuration.
  if (auth.role === 'station') {
    const station = await db.query.stations.findFirst({
      where: eq(stations.user_id, auth.sub),
      columns: { id: true, status: true },
    });

    if (!station) {
      return error403('Station account not found', ApiCode.BUSINESS_NOT_APPROVED);
    }

    if (station.status === 'rejected') {
      return error403('Station account has been rejected', ApiCode.BUSINESS_REJECTED);
    }

    if (station.status === 'suspended') {
      return error403('Station account has been suspended', ApiCode.FORBIDDEN);
    }
  }

  return auth;
}

/**
 * Convenience: require authentication only, but still enforce force_password_change.
 * Equivalent to requireRole with any role accepted, but still checks password change flag.
 */
export async function requireAuthWithPasswordCheck(
  request?: Request
): Promise<JwtPayload | NextResponse> {
  const auth = await requireAuth(request);
  if (auth instanceof Response) return auth as NextResponse;

  if (auth.force_password_change) {
    return error403(
      'You must change your password before continuing',
      ApiCode.PASSWORD_CHANGE_REQUIRED
    );
  }

  return auth;
}
