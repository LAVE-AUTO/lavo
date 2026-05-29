import { isIP } from 'net';
import { normalizeRateLimitKey } from './rate-limiter';

function isValidIp(ip: string): boolean {
  const trimmed = ip.trim();
  if (!trimmed) return false;
  if (trimmed.length > 45) return false; // longer than max IPv6 textual length
  // net.isIP returns 4 / 6 for valid IPv4/IPv6, 0 otherwise — replaces the previous
  // loose regex that accepted strings like "::::::" as valid IPv6.
  return isIP(trimmed) !== 0;
}

/** Uses the standard web `Headers` type; Next.js `headers()` is compatible at runtime. */
export function getClientRateLimitKey(headersList: Headers): string {
  // Prefer x-real-ip if set by a trusted reverse proxy.
  const xRealIp = headersList.get('x-real-ip');
  if (xRealIp && isValidIp(xRealIp)) {
    return normalizeRateLimitKey(`ip:${xRealIp}`);
  }

  // Fallback to x-forwarded-for - take the first value only and validate its shape.
  const xff = headersList.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim() ?? '';
    if (isValidIp(first)) {
      return normalizeRateLimitKey(`ip:${first}`);
    }
  }

  // As a last resort, derive a coarse key from user-agent to avoid a single "unknown"
  // bucket where all unauthenticated traffic shares one rate limit.
  const ua = headersList.get('user-agent') ?? 'unknown';
  const hash = ua.slice(0, 64).toLowerCase();
  return normalizeRateLimitKey(`ua:${hash}`);
}

