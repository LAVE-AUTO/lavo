/**
 * GET /api/v1/history/client/receipt/:entryId
 * Returns Stripe receipt URL (if available) and app receipt payload for one client entry.
 */
import { requireRole } from '@/lib/require-role';
import { successResponse, error400, error404, error500, fromAppError } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';
import { clientHistoryReceiptParamSchema, mapZodErrors } from '@/validators/history';
import { getClientHistoryReceiptDetail } from '@/server/history/client-history-service';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import type { NextResponse } from 'next/server';

type Params = { params: Promise<{ entryId: string }> };

export async function GET(request: Request, { params }: Params): Promise<NextResponse> {
  const auth = await requireRole(request, 'client');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  const { entryId } = await params;
  const parsed = clientHistoryReceiptParamSchema.safeParse({ entryId });
  if (!parsed.success) {
    return applyNoStoreHeaders(
      error400('Validation failed', ApiCode.VALIDATION_FAILED, mapZodErrors(parsed.error))
    );
  }

  try {
    const result = await getClientHistoryReceiptDetail(auth.sub, parsed.data.entryId);
    return applyNoStoreHeaders(successResponse(result));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    return applyNoStoreHeaders(error500(e));
  }
}
