/**
 * In-memory TTL cache for client-side data (e.g. API response caching within a session).
 * Not persistent; cleared on reload. Use to avoid redundant requests for the same data.
 */

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

function isExpired(entry: Entry<unknown>): boolean {
  return Date.now() > entry.expiresAt;
}

/**
 * Store a value with optional TTL in milliseconds. Default 5 minutes.
 */
export function setInMemoryCache<T>(
  key: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  if (!key?.trim()) return;
  store.set(key.trim(), {
    value,
    expiresAt: Date.now() + ttlMs,
  });
}

/**
 * Get a value if present and not expired. Returns null otherwise.
 */
export function getFromMemoryCache<T>(key: string): T | null {
  if (!key?.trim()) return null;
  const entry = store.get(key.trim()) as Entry<T> | undefined;
  if (!entry || isExpired(entry)) {
    store.delete(key.trim());
    return null;
  }
  return entry.value;
}

/**
 * Remove one key.
 */
export function removeFromMemoryCache(key: string): void {
  if (key?.trim()) store.delete(key.trim());
}

/**
 * Clear all cached entries.
 */
export function clearMemoryCache(): void {
  store.clear();
}
