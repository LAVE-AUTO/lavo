/**
 * Response header utilities.
 *
 * Centralised helpers for applying security and cache-control headers to
 * NextResponse objects. Import from here rather than duplicating header
 * logic across route handlers.
 */
import type { NextResponse } from 'next/server';

/**
 * Applies no-store cache-control and security headers to a NextResponse.
 *
 * Sets the following headers:
 *   - Cache-Control: private, no-store
 *   - Pragma: no-cache
 *   - Vary: Authorization, Cookie
 *   - X-Content-Type-Options: nosniff
 *   - X-Frame-Options: DENY
 *   - Referrer-Policy: no-referrer
 *
 * @param response - The NextResponse instance to mutate.
 * @returns The same response instance with headers applied (fluent).
 *
 * @example
 * return applyNoStoreHeaders(NextResponse.json({ ok: true }));
 */
export function applyNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Vary', 'Authorization, Cookie');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
