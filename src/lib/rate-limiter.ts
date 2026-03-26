import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authRateLimits } from '@/lib/db/schema';
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_BLOCK_MINUTES,
} from '@/helpers/server-constants';

if (RATE_LIMIT_MAX_ATTEMPTS < 2) {
  throw new Error(
    `RATE_LIMIT_MAX_ATTEMPTS must be at least 2 (imported from @/helpers/constants); got ${RATE_LIMIT_MAX_ATTEMPTS}. Values below 2 break atomic failed-attempt accounting.`
  );
}

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
 * `RATE_LIMIT_MAX_ATTEMPTS` from `@/helpers/constants` must be at least 2 (asserted at module load).
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

/**
 * Sliding-window quota rate limiter for authenticated actions (e.g. ticket creation,
 * message sending). Unlike the failed-attempt limiter above, this counts every
 * successful action — not just failures — within a rolling time window.
 *
 * Implemented on top of the same `authRateLimits` table, reusing the `key`,
 * `attempts` (used here as the rolling count), and `blocked_until` (used here
 * as the window expiry) columns. When the window has expired the row is reset
 * atomically, so there is no separate cleanup job required.
 *
 * @param key        - Scoped key, e.g. `support:ticket:user:<uuid>`
 * @param limit      - Maximum number of actions allowed within the window
 * @param windowSecs - Rolling window size in seconds (e.g. 3600 for 1 hour)
 * @returns `{ allowed: false, retryAfter }` when the quota is exceeded,
 *          `{ allowed: true }` when the action may proceed.
 */
export async function checkSlidingWindowRateLimit(
  key: string,
  limit: number,
  windowSecs: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = new Date();
  const windowExpiry = new Date(now.getTime() + windowSecs * 1000);

  // Upsert: insert a fresh row (count=1, window starts now) or increment the
  // existing count. When the existing window has expired, reset to 1 and open
  // a fresh window — this is the "sliding" reset behaviour.
  const [row] = await db
    .insert(authRateLimits)
    .values({
      key,
      attempts: 1,
      blocked_until: windowExpiry,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        // If the window has expired, start a fresh window from now.
        attempts: sql`CASE
          WHEN ${authRateLimits.blocked_until} IS NULL OR ${authRateLimits.blocked_until} <= NOW()
          THEN 1
          ELSE ${authRateLimits.attempts} + 1
        END`,
        blocked_until: sql`CASE
          WHEN ${authRateLimits.blocked_until} IS NULL OR ${authRateLimits.blocked_until} <= NOW()
          THEN ${windowExpiry.toISOString()}::timestamptz
          ELSE ${authRateLimits.blocked_until}
        END`,
        updated_at: now,
      },
    })
    .returning();

  const count = row.attempts;
  const windowEnd = row.blocked_until;

  if (count > limit) {
    const retryAfter = windowEnd
      ? Math.max(0, Math.ceil((windowEnd.getTime() - now.getTime()) / 1000))
      : windowSecs;
    return { allowed: false, retryAfter };
  }

  return { allowed: true };
}
