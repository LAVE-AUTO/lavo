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

export async function recordFailedAttempt(key: string): Promise<void> {
  await db
    .insert(authRateLimits)
    .values({ key, attempts: 1 })
    .onConflictDoUpdate({
      target: authRateLimits.key,
      set: {
        attempts: sql`${authRateLimits.attempts} + 1`,
        updated_at: new Date(),
      },
    });

  const row = await db.query.authRateLimits.findFirst({
    where: eq(authRateLimits.key, key),
  });

  if (row && row.attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    const blockedUntil = new Date(
      Date.now() + RATE_LIMIT_BLOCK_MINUTES * 60 * 1000
    );
    await db
      .update(authRateLimits)
      .set({ attempts: 0, blocked_until: blockedUntil, updated_at: new Date() })
      .where(eq(authRateLimits.key, key));
  }
}

export async function resetOnSuccess(key: string): Promise<void> {
  await db.delete(authRateLimits).where(eq(authRateLimits.key, key));
}
