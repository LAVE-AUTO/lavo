/**
 * Lightweight in-memory sliding-window rate limiter for authenticated endpoints.
 *
 * Unlike the DB-backed auth rate limiter (src/lib/rate-limiter.ts) which tracks
 * failed login attempts, this module provides per-user request-count limits
 * using a simple sliding window in process memory.
 *
 * Usage:
 *   const limiter = createEndpointRateLimiter({ maxRequests: 10, windowMs: 60_000 });
 *   // In a route handler (after auth):
 *   if (limiter.isRateLimited(userId)) return error429();
 *
 * Limitations:
 *   - State is per-process and lost on restart (acceptable for abuse prevention).
 *   - Not shared across multiple serverless instances (acceptable at current scale).
 */

interface RateLimiterOptions {
  /** Maximum number of requests allowed within the window. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
}

interface WindowEntry {
  timestamps: number[];
}

const CLEANUP_INTERVAL_MS = 60_000;

export interface EndpointRateLimiter {
  /**
   * Returns true if the key has exceeded the rate limit.
   * Each call counts as a request (i.e. it records the timestamp before checking).
   */
  isRateLimited(key: string): boolean;
}

export function createEndpointRateLimiter(options: RateLimiterOptions): EndpointRateLimiter {
  const { maxRequests, windowMs } = options;
  const store = new Map<string, WindowEntry>();

  // Periodic cleanup of expired entries to prevent unbounded memory growth.
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);

  // Allow the process to exit without waiting for the timer.
  if (typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }

  return {
    isRateLimited(key: string): boolean {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Remove timestamps outside the current window.
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

      // Check before recording: if already at limit, reject.
      if (entry.timestamps.length >= maxRequests) {
        return true;
      }

      // Record this request.
      entry.timestamps.push(now);
      return false;
    },
  };
}
