import { SignJWT, jwtVerify } from 'jose';
import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import {
  ACCESS_TOKEN_EXPIRY,
  REFRESH_COOKIE_NAME,
  JWT_DEFAULT_MAX_AGE,
  JWT_REMEMBER_MAX_AGE,
} from '@/helpers/constants';

export interface JwtPayload {
  sub: string;
  role: string;
  email: string;
  status: string;
  force_password_change: boolean;
}

const MIN_JWT_SECRET_BYTES = 32; // 256-bit minimum for HS256

/** Optional `iss` / `aud` from env; when unset, new tokens omit the claim and verification stays backward-compatible. */
function getOptionalJwtIssuer(): string | undefined {
  const v = process.env.JWT_ISSUER?.trim();
  return v || undefined;
}

function getOptionalJwtAudience(): string | undefined {
  const explicit = process.env.JWT_AUDIENCE?.trim();
  if (explicit) return explicit;
  const app = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!app) return undefined;
  try {
    return new URL(app).origin;
  } catch {
    return undefined;
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  const encoded = new TextEncoder().encode(secret);
  if (encoded.length < MIN_JWT_SECRET_BYTES) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_BYTES} bytes (256 bits). Current length: ${encoded.length} bytes.`
    );
  }
  return encoded;
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  let tokenBuilder = new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY);
  const iss = getOptionalJwtIssuer();
  if (iss) tokenBuilder = tokenBuilder.setIssuer(iss);
  const aud = getOptionalJwtAudience();
  if (aud) tokenBuilder = tokenBuilder.setAudience(aud);
  return tokenBuilder.sign(getSecret());
}

/**
 * Verifies the access JWT. Tokens without `iss`/`aud` still validate (legacy) when env omits issuer/audience.
 * When `JWT_ISSUER` is set, the token MUST include a matching `iss` claim (tokens without `iss` are rejected).
 * When `JWT_AUDIENCE` (or derived audience from `NEXT_PUBLIC_APP_URL`) is set, the token must include `aud`
 * and it must match the expected audience.
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const expectedIss = getOptionalJwtIssuer();
    if (expectedIss && payload.iss !== expectedIss) {
      return null;
    }
    const expectedAud = getOptionalJwtAudience();
    if (expectedAud) {
      const audList = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
      if (!audList.includes(expectedAud)) return null;
    }
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns the options for the httpOnly refresh token cookie.
 *
 * `path: '/api/v1/auth'` is a prefix: the cookie is sent to every route under that segment
 * (register, login, refresh, logout, etc.), not only refresh/logout. Narrowing to
 * `/api/v1/auth/refresh` would reduce exposure but can break clients if logout or rotation
 * expectations change; keep the shared auth prefix unless all call sites are audited.
 */
export function buildRefreshCookieOptions(rememberMe = false): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: rememberMe ? JWT_REMEMBER_MAX_AGE : JWT_DEFAULT_MAX_AGE,
    name: REFRESH_COOKIE_NAME,
  };
}

/**
 * Extracts the Bearer token from an Authorization header value.
 * Returns null if the header is missing or not a Bearer token.
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  return token.length > 0 ? token : null;
}
