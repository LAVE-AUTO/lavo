import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations } from '@/lib/db/schema';
import { requireAuthWithPasswordCheck } from '@/lib/require-role';
import { successResponse, error400, error403, error404, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import type { NextResponse } from 'next/server';

const REAPPLY_COOLDOWN_HOURS = 24;
const MIN_NAME_LENGTH = 2;
const MIN_CITY_LENGTH = 2;

/**
 * POST /api/v1/station/reapply
 * Allows a rejected station to resubmit their KYC application.
 * Resets status to pending_admin_validation and clears the rejection reason.
 * Optionally updates name, address, city, and description.
 * Intentionally bypasses requireRole active-status check — rejected stations need access.
 * Rate-limited: one reapplication per REAPPLY_COOLDOWN_HOURS hours.
 *
 * Body: { name?, address?, city?, description? }
 *
 * Responses:
 *   200 { data: { reapplied: true } }
 *   400 VALIDATION_FAILED — station is not rejected or cooldown active
 *   403 FORBIDDEN — user is not a station
 *   404 NOT_FOUND
 *   429 TOO_MANY_REQUESTS — reapplied too recently
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
      columns: { id: true, status: true, updated_at: true },
    });

    if (!station) {
      return error404('No station found for this account');
    }

    if (station.status !== 'rejected') {
      return error400('Only rejected stations can reapply', ApiCode.VALIDATION_FAILED);
    }

    // Cooldown: prevent spam reapplications
    if (station.updated_at) {
      const hoursSinceLastUpdate =
        (Date.now() - new Date(station.updated_at).getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastUpdate < REAPPLY_COOLDOWN_HOURS) {
        return error400(
          `Please wait ${REAPPLY_COOLDOWN_HOURS} hours before resubmitting`,
          ApiCode.TOO_MANY_REQUESTS
        );
      }
    }

    const { name, address, city, description } = body as {
      name?: string; address?: string; city?: string; description?: string;
    };

    // Validate provided fields
    if (typeof name === 'string' && name.trim().length > 0 && name.trim().length < MIN_NAME_LENGTH) {
      return error400(`Station name must be at least ${MIN_NAME_LENGTH} characters`, ApiCode.VALIDATION_FAILED);
    }
    if (typeof city === 'string' && city.trim().length > 0 && city.trim().length < MIN_CITY_LENGTH) {
      return error400(`City must be at least ${MIN_CITY_LENGTH} characters`, ApiCode.VALIDATION_FAILED);
    }

    const updates: Record<string, unknown> = {
      status: 'pending_admin_validation',
      rejection_reason: null,
      updated_at: new Date(),
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
