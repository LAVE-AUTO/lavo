/**
 * GET /api/v1/service-categories — Public. Returns all active service
 * categories with their nested service types (only hand_wash has any today).
 */
import { getServiceCategoriesWithTypes } from '@/server/station/service-category-service';
import { handleError } from '@/lib/responses';

export async function GET() {
  try {
    const categories = await getServiceCategoriesWithTypes();
    return Response.json({
      data: {
        items: categories.map((c) => ({
          id: c.id,
          code: c.code,
          label: c.label,
          types: c.types.map((t) => ({ id: t.id, code: t.code, label: t.label })),
        })),
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
