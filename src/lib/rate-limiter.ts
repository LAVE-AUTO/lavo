import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { authRateLimits } from '@/lib/db/schema';
import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_BLOCK_MINUTES,
} from '@/helpers/server-constants';
import { getRedisClient } from '@/lib/redis';

if (RATE_LIMIT_MAX_ATTEMPTS < 2) {
  throw new Error(
    `RATE_LIMIT_MAX_ATTEMPTS must be at least 2 (imported from @/helpers/server-constants); got ${RATE_LIMIT_MAX_ATTEMPTS}. Values below 2 break atomic failed-attempt accounting.`
  );
}

/** Duration of a rate-limit block in milliseconds. */
const RATE_LIMIT_BLOCK_MS = RATE_LIMIT_BLOCK_MINUTES * 60_000;

/**
 * Redis key for the block sentinel.
 * Value is the Unix epoch (ms) when the block expires, stored as a string.
 * Key itself expires via Redis TTL so it is cleaned up automatically.
 */
function blockKey(key: string): string {
  return `rl:block:${key}`;
}

/**
 * Redis key for the failed-attempt counter within the current block window.
 * Incremented on each failed attempt; deleted on successful auth.
 */
function countKey(key: string): string {
  return `rl:cnt:${key}`;
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

/**
 * Checks whether the given key is currently rate-limited.
 *
 * Redis-first: reads the block sentinel from Redis (sub-ms, no DB round-trip).
 * Falls back to the DB query when Redis is unavailable.
 */
export async function checkRateLimit(key: string): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get<string>(blockKey(key));
      if (raw !== null && raw !== undefined) {
        const expiresAt = parseInt(String(raw), 10);
        const retryAfter = Math.ceil((expiresAt - Date.now()) / 1000);
        if (retryAfter > 0) {
          return { blocked: true, retryAfter };
        }
        // Block expired but key not yet evicted - treat as unblocked.
      }
      return { blocked: false };
    } catch {
      // Redis unavailable - fall through to DB
    }
  }

  // DB fallback
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
 * in the same row update - avoids read-then-write TOCTOU races under concurrency.
 * `RATE_LIMIT_MAX_ATTEMPTS` from `@/helpers/server-constants` must be at least 2 (asserted at module load).
 *
 * Redis-first: increments the attempt counter in Redis and sets the block sentinel
 * when the threshold is reached. Falls back to the DB upsert when Redis is unavailable.
 */
export async function recordFailedAttempt(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const cKey = countKey(key);
      // Atomically increment and refresh TTL in a single pipeline.
      // Using a pipeline prevents the counter from persisting without a TTL
      // if the connection drops between incr and pexpire.
      const pipe = redis.pipeline();
      pipe.incr(cKey);
      pipe.pexpire(cKey, RATE_LIMIT_BLOCK_MS);
      const [count] = (await pipe.exec()) as [number, number];

      if (count >= RATE_LIMIT_MAX_ATTEMPTS) {
        // Threshold reached: set the block sentinel and reset the counter.
        const expiresAt = Date.now() + RATE_LIMIT_BLOCK_MS;
        const bKey = blockKey(key);
        const blockPipe = redis.pipeline();
        blockPipe.set(bKey, String(expiresAt), { px: RATE_LIMIT_BLOCK_MS });
        blockPipe.del(cKey);
        await blockPipe.exec();
      }
      return;
    } catch {
      // Redis unavailable - fall through to DB
    }
  }

  // DB fallback
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

/**
 * Clears all rate-limit state for the given key on successful authentication.
 *
 * Redis-first: deletes both the block sentinel and the attempt counter.
 * Falls back to the DB delete when Redis is unavailable.
 */
export async function resetOnSuccess(key: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(blockKey(key), countKey(key));
      return;
    } catch {
      // Redis unavailable - fall through to DB
    }
  }

  // DB fallback
  await db.delete(authRateLimits).where(eq(authRateLimits.key, key));
}

/**
 * Sliding-window quota rate limiter for authenticated actions (e.g. ticket creation,
 * message sending). Unlike the failed-attempt limiter above, this counts every
 * successful action - not just failures - within a rolling time window.
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
  // a fresh window - this is the "sliding" reset behaviour.
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
