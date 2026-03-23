import { NextResponse } from 'next/server';
import { error403 } from '@/lib/responses';
import { ApiCode } from '@/types/api-codes';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'DELETE', 'PUT']);

/**
 * Builds allowed Origin / Referer origins for same-site browser API calls.
 * Includes the request URL origin (same deployment) plus public app URL when set.
 */
function collectAllowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  try {
    origins.add(new URL(request.url).origin);
  } catch {
    /* ignore */
  }
  for (const envKey of ['NEXT_PUBLIC_APP_URL', 'APP_URL', 'NEXTAUTH_URL'] as const) {
    const raw = process.env[envKey];
    if (!raw?.trim()) continue;
    try {
      origins.add(new URL(raw.trim()).origin);
    } catch {
      /* ignore */
    }
  }
  return origins;
}

/**
 * When the access JWT comes from a cookie (not Authorization Bearer), mutating requests
 * from a browser must prove same-origin intent: non-empty `X-Requested-With` (not settable
 * on cross-site form posts) or `Origin` / `Referer` matching configured app origins.
 * Bearer-only clients are unchanged. Safe to skip when `request` is omitted (legacy callers).
 */
export function assertSafeCookieAuthForMutation(
  request: Request,
  usedBearer: boolean,
  usedCookie: boolean
): NextResponse | null {
  if (usedBearer || !usedCookie) return null;
  if (!MUTATING_METHODS.has(request.method.toUpperCase())) return null;

  if (request.headers.get('x-requested-with')?.trim()) return null;

  const allowed = collectAllowedOrigins(request);
  const origin = request.headers.get('origin');
  if (origin && allowed.has(origin)) return null;

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      if (allowed.has(new URL(referer).origin)) return null;
    } catch {
      /* ignore */
    }
  }

  return error403(
    'Cookie authentication requires a same-origin request or X-Requested-With header',
    ApiCode.FORBIDDEN
  );
}
