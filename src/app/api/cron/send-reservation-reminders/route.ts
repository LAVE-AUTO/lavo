/**
 * GET /api/cron/send-reservation-reminders
 * Cron endpoint: sends push reminders for reservations 5h and 30min before service start.
 * Requires x-cron-secret or Authorization: Bearer <CRON_SECRET>.
 *
 * Recommended schedule: every 10 minutes (covers the 14-minute tolerance window).
 *
 * Responses:
 *   200 { data: { reminders_5h: { processed, succeeded, failed }, reminders_30min: { ... } } }
 *   401 Missing or invalid cron secret
 *   500 INTERNAL_ERROR
 */
import { headers } from 'next/headers';
import { verifyCronSecret } from '@/lib/verify-cron-secret';
import { runSendReservationReminders } from '@/jobs/send-reservation-reminders';
import { successResponse, error401, error500 } from '@/lib/responses';
import { HTTP_STATUS } from '@/helpers/constants';

export async function GET() {
  const headersList = await headers();
  const auth = headersList.get('authorization');
  const bearerToken = auth?.match(/^Bearer\s*(.*)$/i)?.[1]?.trim() ?? '';
  const secret = headersList.get('x-cron-secret') ?? bearerToken;
  const expected = process.env.CRON_SECRET ?? '';

  if (!verifyCronSecret(secret, expected)) {
    return error401('Missing or invalid cron secret');
  }

  try {
    const result = await runSendReservationReminders();
    return successResponse(result, undefined, HTTP_STATUS.OK);
  } catch (e) {
    return error500(e);
  }
}
