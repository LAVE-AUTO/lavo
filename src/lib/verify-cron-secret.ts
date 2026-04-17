/**
 * Constant-time verification of cron secret to prevent timing attacks.
 * Use for all cron endpoints that require CRON_SECRET.
 */
import { timingSafeEqual } from 'crypto';

export function verifyCronSecret(secret: string, expected: string): boolean {
  if (!expected || !secret) return false;
  const a = Buffer.from(secret, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
