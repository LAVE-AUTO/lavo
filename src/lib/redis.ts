/**
 * Singleton Upstash Redis client.
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.
 * Falls back gracefully when unavailable - callers must handle null returns.
 */
import { Redis } from '@upstash/redis';

let _redis: Redis | null = null;

/**
 * Returns the shared Redis client, or null if connection credentials are not configured.
 * Initializes the client on first call and reuses it on subsequent calls.
 */
export function getRedisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _redis;
}
