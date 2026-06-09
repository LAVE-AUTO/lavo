import type { NextResponse } from 'next/server';
import { requireRole } from '@/lib/require-role';
import { successResponse, error404, fromAppError, error500 } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId } from '@/server/station/station-repository';
import { createStripeExpressDashboardLink } from '@/server/payments/payment-service';
import { HTTP_STATUS } from '@/helpers/constants';

export async function GET(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await findStationByUserId(auth.sub);
    if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

    if (!station.stripe_account_id?.startsWith('acct_')) {
      throw new AppError('Stripe account not configured for this station', HTTP_STATUS.UNPROCESSABLE_ENTITY);
    }

    const url = await createStripeExpressDashboardLink(station.stripe_account_id);
    return applyNoStoreHeaders(successResponse({ url }));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[GET /api/v1/station/stripe/dashboard-link] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
