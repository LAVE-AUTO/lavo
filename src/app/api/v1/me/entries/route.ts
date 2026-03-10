/**
 * GET /api/v1/me/entries
 * List current user's entries (reservations and queue). Auth: client.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { listMyEntries } from '@/server/reservations/reservation-service';
import { serializeEntry } from '@/server/reservations/entry-serializer';
import { AppError } from '@/lib/errors';
import type { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const auth = await requireRole('client');
  if (auth instanceof Response) return auth as NextResponse;

  try {
    const entries = await listMyEntries(auth.sub);
    return successResponse(entries.map(serializeEntry));
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}

