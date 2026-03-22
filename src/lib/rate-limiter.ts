import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authRateLimits } from '@/lib/db/schema';
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_BLOCK_MINUTES,
} from '@/helpers/constants';

export interface RateLimitResult {
  blocked: boolean;
  retryAfter?: number;
}

export function normalizeRateLimitKey(rawKey: string | null | undefined): string {
  if (!rawKey) return 'unknown';
  const trimmed = rawKey.trim();
  if (!trimmed) return 'unknown';
  return trimmed.toLowerCase();
}

export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const row = await db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.key, key),
  });

  if (!row) return { blocked: false };

  if (row.blocked_until && row.blocked_until > new Date()) {
    const retryAfter = Math.ceil(
      (row.blocked_until.getTime() - Date.now()) / 1000
    );
    return { blocked: true, retryAfter };
  }

  return { blocked: false };
}

/**
 * Records one failed auth attempt in a single atomic statement (insert or increment).
 * When the post-increment count reaches the threshold, resets attempts and sets `blocked_until`
 * in the same row update — avoids read-then-write TOCTOU races under concurrency.
 */
export async function recordFailedAttempt(key: string): Promise<void> {
  await db
    .insert(authRateLimits)
    .values({ key, attempts: 1, updated_at: new Date() })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        attempts: sql`CASE
          WHEN (${authRateLimits.attempts} + 1) >= ${RATE_LIMIT_MAX_ATTEMPTS} THEN 0
          ELSE ${authRateLimits.attempts} + 1
        END`,
        blocked_until: sql`CASE
          WHEN (${authRateLimits.attempts} + 1) >= ${RATE_LIMIT_MAX_ATTEMPTS}
          THEN NOW() + (${sql.raw(String(RATE_LIMIT_BLOCK_MINUTES))} * INTERVAL '1 minute')
          ELSE ${authRateLimits.blocked_until}
        END`,
        updated_at: new Date(),
      },
    });
}

export async function resetOnSuccess(key: string): Promise<void> {
  await db.delete(authRateLimits).where(eq(authRateLimits.key, key));
}
