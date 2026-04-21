/**
 * GET /api/cron/send-kyc-expiry-reminders
 * Cron endpoint: sends KYC document expiry reminders to station owners and active admins.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: daily at 8am (configure via KYC_REMINDER_CRON_SCHEDULE env var,
 * default: 0 8 * * *).
 *
 * Responses:
 *   200 { data: { first_reminder: { processed, succeeded, failed }, second_reminder: { ... } } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
import { headers } from 'next/headers';
import { verifyCronSecret } from '@/lib/verify-cron-secret';
import { runSendKycExpiryReminders } from '@/jobs/send-kyc-expiry-reminders';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';


// %%%%% Route handler %%%%%
// Auth check, job dispatch, and response shaping

export async function GET() {
  // Extract secret from x-cron-secret header or Bearer token
  const headersList = await headers();
  const auth = headersList.get('authorization');
  const bearerToken = auth?.match(/^Bearer\s*(.*)$/i)?.[1]?.trim() ?? '';
  const secret = headersList.get('x-cron-secret') ?? bearerToken;
  const expected = process.env.CRON_SECRET ?? '';

  if (!verifyCronSecret(secret, expected)) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSendKycExpiryReminders();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}


// %%%%% END - Route handler %%%%%
