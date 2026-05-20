import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500 } from '@/lib/responses';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { ApiCode } from '@/types/api-codes';
import { listAdminLogs } from '@/server/admin/admin-log-repository';

const querySchema = z.object({
  page:     z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
  action:   z.string().max(100).optional(),
  admin_id: z.string().uuid().optional(),
  date_from: z.coerce.date().optional(),
  date_to:   z.coerce.date().optional(),
});

/**
 * GET /api/v1/admin/logs
 * Paginated admin activity log. Admin role required.
 *
 * Query params:
 *   page, per_page, action, admin_id, date_from, date_to
 *
 * Responses:
 *   200 { data: { items: AdminLogEntry[], meta: { total, page, per_page, total_pages } } }
 *   400 VALIDATION_FAILED
 *   401 UNAUTHORIZED
 *   403 FORBIDDEN
 *   500 INTERNAL_ERROR
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireRole(request, 'admin');
  if (auth instanceof Response) return auth as NextResponse;

  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED),
    );
  }

  const { page, per_page, action, admin_id, date_from, date_to } = parsed.data;

  try {
    const { items, total } = await listAdminLogs(
      { action, admin_id, date_from, date_to },
      page,
      per_page,
    );
    return applyNoStoreHeaders(
      successResponse({
        items,
        meta: { total, page, per_page, total_pages: Math.ceil(total / per_page) },
      }),
    );
  } catch (e) {
    console.error('[GET /api/v1/admin/logs] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
