import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations } from '@/lib/db/schema';
import { requireAuthWithPasswordCheck } from '@/lib/require-role';
import { successResponse, error400, error403, error404, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import type { NextResponse } from 'next/server';

/**
 * POST /api/v1/station/reapply
 * Allows a rejected station to resubmit their KYC application.
 * Resets status to pending_admin_validation and clears the rejection reason.
 * Optionally updates name, address, city, and description.
 * Does NOT require active status.
 *
 * Body: { name?, address?, city?, description? }
 *
 * Responses:
 *   200 { data: { reapplied: true } }
 *   400 VALIDATION_FAILED — if station is not rejected
 *   403 FORBIDDEN — if user is not a station
 *   404 NOT_FOUND
 *   500 INTERNAL_ERROR
 */
export async function POST(request: Request) {
  const auth = await requireAuthWithPasswordCheck(request);
  if (auth instanceof Response) return auth as NextResponse;

  if (auth.role !== 'station') {
    return error403('Access restricted to station accounts', ApiCode.FORBIDDEN);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — all fields are optional
  }

  try {
    const station = await db.query.stations.findFirst({
      where: eq(stations.user_id, auth.sub),
      columns: { id: true, status: true },
    });

    if (!station) {
      return error404('No station found for this account');
    }

    if (station.status !== 'rejected') {
      return error400('Only rejected stations can reapply', ApiCode.VALIDATION_FAILED);
    }

    // Build optional updates (only accepted text fields)
    const updates: Record<string, unknown> = {
      status: 'pending_admin_validation',
      rejection_reason: null,
      updated_at: new Date(),
    };

    const { name, address, city, description } = body as {
      name?: string; address?: string; city?: string; description?: string;
    };

    if (typeof name === 'string' && name.trim()) updates.name = name.trim().slice(0, 150);
    if (typeof address === 'string' && address.trim()) updates.address = address.trim().slice(0, 200);
    if (typeof city === 'string' && city.trim()) updates.city = city.trim().slice(0, 100);
    if (typeof description === 'string') updates.description = description.trim().slice(0, 1000) || null;

    await db.update(stations).set(updates).where(eq(stations.id, station.id));

    return successResponse({ reapplied: true }, 'Application resubmitted successfully.');
  } catch (e) {
    return error500(e);
  }
}
