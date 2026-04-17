/**
 * GET /api/v1/station/config
 * Returns the authenticated station's config and posts. Creates default config on first read.
 *
 * PATCH /api/v1/station/config
 * Updates station config and optionally station_posts. Auth STATION; body validated with Zod.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { findStationByUserId } from '@/server/station/station-repository';
import { getOrCreateConfig, updateConfig } from '@/server/station/config-service';
import { stationConfigBodySchema, mapZodErrors } from '@/validators/station';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

function serializeConfig(config: { [k: string]: unknown }) {
  return {
    id: config.id,
    opening_time: config.opening_time,
    closing_time: config.closing_time,
    break_start: config.break_start,
    break_end: config.break_end,
    wash_duration_minutes: config.wash_duration_minutes,
    wash_post_count: config.wash_post_count,
    late_tolerance_minutes: config.late_tolerance_minutes,
    cancellation_delay_minutes: config.cancellation_delay_minutes,
    max_concurrent_posts: config.max_concurrent_posts,
    margin_before_minutes: config.margin_before_minutes,
    margin_after_minutes: config.margin_after_minutes,
    reservation_surcharge: config.reservation_surcharge,
    updated_at: config.updated_at,
  };
}

function serializePost(post: { id: string; station_id: string; position: number; is_active: boolean }) {
  return { id: post.id, station_id: post.station_id, position: post.position, is_active: post.is_active };
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireRole(undefined, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await findStationByUserId(auth.sub);
    if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));
    const { config, posts } = await getOrCreateConfig(station.id);
    return applyNoStoreHeaders(
      successResponse({
        config: serializeConfig(config),
        posts: posts.map(serializePost),
      })
    );
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return applyNoStoreHeaders(error400('Invalid JSON body', ApiCode.VALIDATION_FAILED));
  }

  const parsed = stationConfigBodySchema.safeParse(body);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  const station = await findStationByUserId(auth.sub);
  if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

  const { posts, ...configFields } = parsed.data;
  const configPayload: Parameters<typeof updateConfig>[1] = {};
  if (configFields.opening_time !== undefined) configPayload.opening_time = configFields.opening_time;
  if (configFields.closing_time !== undefined) configPayload.closing_time = configFields.closing_time;
  if (configFields.break_start !== undefined) configPayload.break_start = configFields.break_start;
  if (configFields.break_end !== undefined) configPayload.break_end = configFields.break_end;
  if (configFields.wash_duration_minutes !== undefined)
    configPayload.wash_duration_minutes = configFields.wash_duration_minutes;
  if (configFields.wash_post_count !== undefined) configPayload.wash_post_count = configFields.wash_post_count;
  if (configFields.late_tolerance_minutes !== undefined)
    configPayload.late_tolerance_minutes = configFields.late_tolerance_minutes;
  if (configFields.cancellation_delay_minutes !== undefined)
    configPayload.cancellation_delay_minutes = configFields.cancellation_delay_minutes;
  if (configFields.max_concurrent_posts !== undefined)
    configPayload.max_concurrent_posts = configFields.max_concurrent_posts;
  if (configFields.margin_before_minutes !== undefined)
    configPayload.margin_before_minutes = configFields.margin_before_minutes;
  if (configFields.margin_after_minutes !== undefined)
    configPayload.margin_after_minutes = configFields.margin_after_minutes;
  if (configFields.reservation_surcharge !== undefined)
    configPayload.reservation_surcharge = configFields.reservation_surcharge;

  try {
    const { config, posts: updatedPosts } = await updateConfig(
      station.id,
      configPayload,
      posts
    );
    return applyNoStoreHeaders(
      successResponse({
        config: serializeConfig(config),
        posts: updatedPosts.map(serializePost),
      })
    );
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
