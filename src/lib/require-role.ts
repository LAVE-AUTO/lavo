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
 * For station role: also verifies that the associated station has status = 'active'.
 * For any role: if force_password_change is true, returns 403 PASSWORD_CHANGE_REQUIRED.
 *
 * Usage:
 *   const result = await requireRole('admin');
 *   if (result instanceof NextResponse) return result;
 *   const { sub, role } = result;
 */
export async function requireRole(
  ...allowedRoles: string[]
): Promise<JwtPayload | NextResponse> {
  const auth = await requireAuth();
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

  // For station accounts, the station itself must be active (approved by admin)
  if (auth.role === 'station') {
    const station = await db.query.stations.findFirst({
      where: eq(stations.user_id, auth.sub),
      columns: { id: true, status: true },
    });

    if (!station || station.status !== 'active') {
      return error403(
        'Station account is pending approval',
        ApiCode.BUSINESS_NOT_APPROVED
      );
    }
  }

  return auth;
}

/**
 * Convenience: require authentication only, but still enforce force_password_change.
 * Equivalent to requireRole with any role accepted, but still checks password change flag.
 */
export async function requireAuthWithPasswordCheck(): Promise<JwtPayload | NextResponse> {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth as NextResponse;

  if (auth.force_password_change) {
    return error403(
      'You must change your password before continuing',
      ApiCode.PASSWORD_CHANGE_REQUIRED
    );
  }

  return auth;
}
