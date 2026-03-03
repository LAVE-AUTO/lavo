/**
 * Client-side document.cookie helpers for non-sensitive data only.
 * Use for preferences (e.g. consent banner, UI state) that should be sent with requests.
 * Do not use for auth tokens; use httpOnly cookies set by the server instead.
 */

function isAvailable(): boolean {
  return typeof document !== 'undefined' && typeof document.cookie !== 'undefined';
}

export interface SetCookieOptions {
  maxAge?: number;
  path?: string;
  sameSite?: 'strict' | 'lax' | 'none';
  secure?: boolean;
}

/**
 * Read the first cookie with the given name. Returns null if missing or not in browser.
 */
export function getCookie(name: string): string | null {
  if (!name?.trim() || !isAvailable()) return null;
  const decoded = decodeURIComponent(document.cookie);
  const parts = decoded.split(';');
  const prefix = `${name.trim()}=`;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim() || null;
    }
  }
  return null;
}

/**
 * Set a cookie. Value is stored as-is; encode if it contains semicolons or commas.
 */
export function setCookie(
  name: string,
  value: string,
  options: SetCookieOptions = {}
): void {
  if (!name?.trim() || !isAvailable()) return;
  const { maxAge, path = '/', sameSite = 'lax', secure = false } = options;
  let cookie = `${encodeURIComponent(name.trim())}=${encodeURIComponent(value)}`;
  if (maxAge != null) cookie += `; max-age=${maxAge}`;
  cookie += `; path=${path}`;
  cookie += `; samesite=${sameSite}`;
  if (secure) cookie += '; secure';
  document.cookie = cookie;
}

/**
 * Remove a cookie by setting max-age=0. Pass the same path used when setting.
 */
export function removeCookie(name: string, path?: string): void {
  if (!name?.trim() || !isAvailable()) return;
  const p = path ?? '/';
  document.cookie = `${encodeURIComponent(name.trim())}=; path=${p}; max-age=0`;
}
