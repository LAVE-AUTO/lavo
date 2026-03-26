import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { clientHistoryQuerySchema, mapZodErrors } from '@/validators/history';
import { getClientHistory } from '@/server/history/client-history-service';
import { AppError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

/**
 * GET /api/v1/history/client
 * Returns paginated client history with filters and receipt metadata.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { searchParams } = new URL(request.url);
  const raw = {
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    status: searchParams.getAll('status'),
    entry_type: searchParams.get('entry_type') ?? undefined,
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    amount_min: searchParams.get('amount_min') ?? undefined,
    amount_max: searchParams.get('amount_max') ?? undefined,
    q: searchParams.get('q') ?? undefined,
    sort_by: searchParams.get('sort_by') ?? undefined,
    sort_order: searchParams.get('sort_order') ?? undefined,
  };

  const parsed = clientHistoryQuerySchema.safeParse(raw);
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const result = await getClientHistory(auth.sub, parsed.data);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}

