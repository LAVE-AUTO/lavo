/**
 * GET /api/v1/stations/:id/formats
 * Public. Returns all global vehicle formats (station param kept for backward compatibility).
 */
import type { NextResponse } from 'next/server';
import { successResponse, error500, fromAppError } from '@/lib/responses';
import { getFormatsPaginated } from '@/server/station/format-service';
import { AppError } from '@/lib/errors';
import { serializeFormat } from '@/server/station/serializers';
import { z } from 'zod';

type Params = { params: Promise<{ id: string }> };
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: Request, _ctx: Params): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse(Object.fromEntries(searchParams));
    const result = await getFormatsPaginated(parsed.page, parsed.per_page);
    return successResponse({
      items: result.items.map(serializeFormat),
      meta: {
        total: result.total,
        page: parsed.page,
        per_page: parsed.per_page,
        total_pages: Math.max(1, Math.ceil(result.total / parsed.per_page)),
      },
    });
  } catch (e) {
    if (e instanceof AppError) return fromAppError(e);
    return error500(e);
  }
}
