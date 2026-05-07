import type { NextResponse } from 'next/server';

import { requireRole } from '@/lib/require-role';
import { successResponse, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId } from '@/server/station/station-repository';
import { stripe } from '@/lib/stripe';

export async function GET(): Promise<NextResponse> {
  const auth = await requireRole(undefined, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await findStationByUserId(auth.sub);
    if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

    if (!station.stripe_account_id) {
      return applyNoStoreHeaders(successResponse({ connected: false }));
    }

    const account = await stripe.accounts.retrieve(station.stripe_account_id);

    return applyNoStoreHeaders(successResponse({
      connected: true,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
    }));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[GET /api/v1/station/stripe/status] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
