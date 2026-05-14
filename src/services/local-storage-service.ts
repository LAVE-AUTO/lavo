/**
 * Client-side localStorage abstraction.
 * SSR-safe: all operations no-op when window is undefined.
 * Values are JSON-serialized; use get<T> for typed reads.
 */

function isAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/**
 * Store a value under key. Serializes with JSON. Returns false if storage unavailable or key empty.
 */
export function setInLocalStorage(key: string, value: unknown): boolean {
  if (!key || key.trim() === '') return false;
  if (!isAvailable()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/**
 * Read and parse a value from localStorage. Returns null when key is missing, empty, or invalid.
 */
export function getFromLocalStorage<T = unknown>(key: string): T | null {
  if (!key || key.trim() === '') return null;
  if (!isAvailable()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Remove one key. No-op when storage unavailable.
 */
export function removeFromLocalStorage(key: string): void {
  if (!key || !isAvailable()) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/**
 * Remove all keys with the given prefix (e.g. "Hurryline_").
 */
export function clearLocalStorageByPrefix(prefix: string): void {
  if (!isAvailable() || !prefix) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith(prefix)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

/**
 * Clear entire localStorage. Use with care.
 */
export function clearLocalStorage(): void {
  if (!isAvailable()) return;
  try {
    window.localStorage.clear();
  } catch {
    // ignore
  }
}
