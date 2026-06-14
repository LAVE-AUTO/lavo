import type { NextResponse } from 'next/server';

import { requireRole } from '@/lib/require-role';
import { successResponse, error403, error404, error500, fromAppError } from '@/lib/responses';
import { AppError, NotFoundError } from '@/lib/errors';
import { applyNoStoreHeaders } from '@/lib/response-headers';
import { findStationByUserId, updateStationInfo } from '@/server/station/station-repository';
import { createStripeConnectAccount, createStripeOnboardingLink } from '@/server/payments/payment-service';

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireRole(request, 'station');
  if (auth instanceof Response) return applyNoStoreHeaders(auth as NextResponse);

  try {
    const station = await findStationByUserId(auth.sub);
    if (!station) return applyNoStoreHeaders(error404('No station associated with this account'));

    if (station.status !== 'active') {
      return applyNoStoreHeaders(error403('Station must be active to configure Stripe'));
    }

    let accountId = station.stripe_account_id;

    if (!accountId) {
      accountId = await createStripeConnectAccount(auth.email, station.id);
      await updateStationInfo(station.id, { stripe_account_id: accountId });
    }

    const acceptLang = request.headers.get('accept-language') ?? 'fr';
    const locale = acceptLang.startsWith('en') ? 'en' : 'fr';
    const url = await createStripeOnboardingLink(accountId, locale);

    return applyNoStoreHeaders(successResponse({ url }));
  } catch (e) {
    if (e instanceof NotFoundError) return applyNoStoreHeaders(error404(e.message));
    if (e instanceof AppError) return applyNoStoreHeaders(fromAppError(e));
    console.error('[POST /api/v1/station/stripe/onboarding] Unhandled error:', e);
    return applyNoStoreHeaders(error500());
  }
}
