import { NextResponse } from 'next/server';
import { successResponse, error400, error500 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { listStationsQuerySchema, mapZodErrors } from '@/validators/station';
import { listStationsPublic } from '@/server/station/station-service';

/**
 * GET /api/v1/stations
 * List active stations with optional search (q), city filter, and sort (e.g. slots_asc, slots_desc, name).
 * Each station includes available (boolean, true iff available_slots > 0) and available_slots (number).
 *
 * Query params: q (search), city, sort.
 * Response 200: { data: Array<Station & { available: boolean; available_slots: number }> }.
 * Responses: 400 VALIDATION_FAILED, 500 INTERNAL_ERROR.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = {
    q: searchParams.get('q') ?? undefined,
    city: searchParams.get('city') ?? undefined,
    sort: searchParams.get('sort') ?? undefined,
  };
  const parsed = listStationsQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error));
  }
  try {
    const list = await listStationsPublic({
      search: parsed.data.q,
      city: parsed.data.city,
      sort: parsed.data.sort,
    });
    return successResponse(list);
  } catch (e) {
    return error500(e);
  }
}
