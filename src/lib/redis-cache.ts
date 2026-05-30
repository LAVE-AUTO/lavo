/**
 * Redis-backed TTL cache with transparent DB fallback.
 * If Redis is unavailable, fetch() is called directly (no caching).
 */
import { getRedisClient } from './redis';

/**
 * Wrapper stored in Redis so that a legitimately cached `null` value is
 * distinguishable from a Redis cache miss (which also returns `null`).
 */
type CacheEnvelope<T> = { v: T };

/**
 * Returns a cached value from Redis if present, otherwise calls fetch(),
 * stores the result under key with the given TTL, and returns it.
 * Falls back to calling fetch() directly when Redis is unavailable.
 *
 * Values are wrapped in a `{ v }` envelope before storage so that a
 * legitimately cached `null` is distinguishable from a Redis miss.
 *
 * @param key - Redis key to read from / write to
 * @param ttlSeconds - Time-to-live for the cached value in seconds
 * @param fetch - Async function that produces the value on a cache miss
 */
export async function getCachedOrFetch<T>(
  key: string,
  ttlSeconds: number,
  fetch: () => Promise<T>
): Promise<T> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const envelope = await redis.get<CacheEnvelope<T>>(key);
      if (envelope !== null && envelope !== undefined) return envelope.v;
      const value = await fetch();
      await redis.set(key, { v: value } satisfies CacheEnvelope<T>, { ex: ttlSeconds });
      return value;
    } catch {
      // Redis unavailable - fall through to direct fetch
    }
  }
  return fetch();
}

/**
 * Deletes a single key from the Redis cache.
 * No-ops silently when Redis is unavailable; in-process caches will expire naturally.
 *
 * @param key - Redis key to delete
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Redis unavailable - in-process caches will expire naturally
  }
}
