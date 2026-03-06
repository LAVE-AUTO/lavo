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
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(getSecret());
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Returns the options for the httpOnly refresh token cookie.
 * path is scoped to /api/v1/auth so the cookie is only sent to refresh/logout endpoints.
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
