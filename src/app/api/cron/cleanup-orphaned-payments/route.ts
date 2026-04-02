/**
 * GET /api/cron/cleanup-orphaned-payments
 * Cron endpoint: cancels queue entries stuck in 'pending_payment' with no stripe_payment_id.
 * These entries are created by the walk-in flow before calling Stripe; if the server crashes
 * between the DB insert and the PaymentIntent creation the entry is never resolved by a webhook.
 * Requires Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 * Reads ORPHAN_PAYMENT_TIMEOUT_MINUTES from env (default: 15).
 */
import { headers } from 'next/headers';

import { verifyCronSecret } from '@/lib/verify-cron-secret';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';
import { cleanupOrphanedPaymentEntries } from '@/server/reservations/orphan-cleanup-service';


// %%%%% Constants %%%%%
// Timeout configuration

const DEFAULT_TIMEOUT_MINUTES = 15;


// %%%%% GET Handler %%%%%
// Cleanup orphaned payment entries

export async function GET() {
  const headersList = await headers();
  const auth = headersList.get('authorization');
  const bearerToken = auth?.match(/^Bearer\s*(.*)$/i)?.[1]?.trim() ?? '';
  const secret = headersList.get('x-cron-secret') ?? bearerToken;
  const expected = process.env.CRON_SECRET ?? '';

  if (!verifyCronSecret(secret, expected)) {
    return error401('Missing or invalid cron secret');
  }

  const rawTimeout = process.env.ORPHAN_PAYMENT_TIMEOUT_MINUTES;
  const timeoutMinutes = rawTimeout ? parseInt(rawTimeout, 10) : DEFAULT_TIMEOUT_MINUTES;
  const resolvedTimeout = Number.isFinite(timeoutMinutes) && timeoutMinutes > 0
    ? timeoutMinutes
    : DEFAULT_TIMEOUT_MINUTES;

  try {
    const result = await cleanupOrphanedPaymentEntries(resolvedTimeout);
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
