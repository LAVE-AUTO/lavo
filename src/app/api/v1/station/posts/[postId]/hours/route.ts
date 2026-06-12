/**
 * PUT /api/v1/station/posts/:postId/hours - upsert one post's per-day windows.
 * Each day is validated server-side to stay within the station's hours. Auth: station.
 *
 * Body: { days: Array<{ day_of_week: 0-6, is_open: bool, morning_start?, morning_end?, afternoon_start?, afternoon_end? }> }
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { updateStationPostHours } from '@/server/station/station-post-hours-service';
import { findStationByUserId } from '@/server/station/station-repository';
import { AppError, ValidationError } from '@/lib/errors';
import { z } from 'zod';
import type { NextResponse } from 'next/server';

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const daySchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  is_open: z.boolean(),
  morning_start: z.string().regex(timePattern).nullable().optional(),
  morning_end: z.string().regex(timePattern).nullable().optional(),
  afternoon_start: z.string().regex(timePattern).nullable().optional(),
  afternoon_end: z.string().regex(timePattern).nullable().optional(),
});

const bodySchema = z.object({ days: z.array(daySchema).min(1).max(7) });

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const { postId } = await params;
  if (!z.string().uuid().safeParse(postId).success) {
    return applyNoStoreHeaders(error400('Invalid post id', ApiCode.VALIDATION_FAILED));
  }

  let body: unknown;
  try { body = await request.json(); } catch { return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED)); }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return applyNoStoreHeaders(error400('Validation failed', ApiCode.VALIDATION_FAILED));

  try {
    const data = await updateStationPostHours(
      station.id,
      postId,
      parsed.data.days.map((d) => ({
        day_of_week: d.day_of_week,
        is_open: d.is_open,
        morning_start: d.morning_start ?? null,
        morning_end: d.morning_end ?? null,
        afternoon_start: d.afternoon_start ?? null,
        afternoon_end: d.afternoon_end ?? null,
      })),
    );
    return applyNoStoreHeaders(successResponse(data));
  } catch (e) {
    if (e instanceof ValidationError) return applyNoStoreHeaders(error400(e.message, ApiCode.VALIDATION_FAILED));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
