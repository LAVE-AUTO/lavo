/**
 * Shared cron authentication helper.
 *
 * Centralises the Bearer / x-cron-secret parsing used by every /api/cron/* route so a single
 * fix lands everywhere (bug #23: previously some routes would skip the bearer fallback when
 * `x-cron-secret` was set to an empty/whitespace string).
 */
import { headers } from 'next/headers';
import { verifyCronSecret } from '@/lib/verify-cron-secret';

/**
 * Returns true when the incoming cron request carries a valid CRON_SECRET via either
 * `x-cron-secret` or `Authorization: Bearer <secret>` headers. Whitespace-only header values
 * are treated as missing so a misconfigured deployment falls through to the bearer fallback.
 */
export async function isAuthorizedCronRequest(): Promise<boolean> {
  const headersList = await headers();
  const auth = headersList.get('authorization');
  const bearerToken = auth?.match(/^Bearer\s*(.*)$/i)?.[1]?.trim() ?? '';
  // `?.trim() || bearerToken` falls back to bearer when x-cron-secret is missing OR empty/whitespace.
  const xCron = headersList.get('x-cron-secret')?.trim() || '';
  const secret = xCron || bearerToken;
  const expected = process.env.CRON_SECRET ?? '';
  return verifyCronSecret(secret, expected);
}
