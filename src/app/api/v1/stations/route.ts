import { NextResponse } from 'next/server';
import { error400, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { parseStationSortString } from '@/helpers/sort-stations';
import { listStationsQuerySchema, mapZodErrors } from '@/validators/station';
import { listStationsPublic } from '@/server/station/station-service';

/**
 * GET /api/v1/stations
 * List active stations with optional search (q), city, sort (multi-criteria), pagination, and groups.
 * Response: { data: { all: Station[], available_now?, most_appreciated?, most_visited? }, meta: { total, page, per_page, total_pages } }.
 * Query params: groups, q, city, sort, page, per_page, limit_per_group, wash_type_ids, service_scope, format_id, date (date/slot no-op in repo).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = {
    q: searchParams.get('q') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
    groups: searchParams.get('groups') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    per_page: searchParams.get('per_page') ?? undefined,
    limit_per_group: searchParams.get('limit_per_group') ?? undefined,
    wash_type_ids: searchParams.get('wash_type_ids') ?? undefined,
    service_scope: searchParams.get('service_scope') ?? undefined,
    format_id: searchParams.get('format_id') ?? undefined,
    date: searchParams.get('date') ?? undefined,
    near_lat: searchParams.get('near_lat') ?? undefined,
    near_lng: searchParams.get('near_lng') ?? undefined,
    distance_min_km: searchParams.get('distance_min_km') ?? undefined,
    distance_max_km: searchParams.get('distance_max_km') ?? undefined,
  };
  const parsed = listStationsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }
  try {
    const sortArray = parseStationSortString(parsed.data.sort);
    const page = parsed.data.page ?? 1;
    const per_page = parsed.data.per_page ?? 20;
    const result = await listStationsPublic({
      search: parsed.data.q,
      city: parsed.data.city,
      sort: sortArray.length > 0 ? sortArray : undefined,
      groups: parsed.data.groups,
      page,
      per_page,
      limit_per_group: parsed.data.limit_per_group,
      wash_type_ids: parsed.data.wash_type_ids,
      service_scope: parsed.data.service_scope,
      format_id: parsed.data.format_id,
      near_lat: parsed.data.near_lat,
      near_lng: parsed.data.near_lng,
      distance_min_km: parsed.data.distance_min_km,
      distance_max_km: parsed.data.distance_max_km,
    });
    const response = NextResponse.json({ data: result.data, meta: result.meta }, { status: 200 });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (e) {
    return error500(e);
  }
}
