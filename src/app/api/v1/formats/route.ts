/**
 * GET /api/v1/formats — Public. Returns all active global vehicle formats.
 */
import { getFormatsPaginated } from '@/server/station/format-service';
import { handleError } from '@/lib/responses';
import { z } from 'zod';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.parse(Object.fromEntries(searchParams));
    const result = await getFormatsPaginated(parsed.page, parsed.per_page);
    return Response.json({
      data: {
        items: result.items,
        meta: {
          total: result.total,
          page: parsed.page,
          per_page: parsed.per_page,
          total_pages: Math.max(1, Math.ceil(result.total / parsed.per_page)),
        },
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
