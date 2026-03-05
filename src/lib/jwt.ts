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

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return new TextEncoder().encode(secret);
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
