import { normalizeRateLimitKey } from './rate-limiter';

function isValidIp(ip: string): boolean {
  // Very small safeguard: reject values that clearly are not an IP address.
  // This is not a full validator but helps mitigate simple header spoofing.
  const trimmed = ip.trim();
  if (!trimmed) return false;
  if (trimmed.length > 45) return false; // longer than max IPv6 textual length
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv4.test(trimmed) || ipv6.test(trimmed);
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

