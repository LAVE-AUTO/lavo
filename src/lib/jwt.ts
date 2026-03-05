import { SignJWT, jwtVerify } from 'jose';
import {
  ACCESS_COOKIE_NAME,
  ACCESS_TOKEN_EXPIRY,
  ACCESS_TOKEN_MAX_AGE,
  JWT_DEFAULT_MAX_AGE,
  JWT_REMEMBER_MAX_AGE,
  REFRESH_COOKIE_NAME,
} from '@/helpers/constants';

export interface JwtPayload {
  sub: string;
  role: string;
  email: string;
  status: string;
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

export function buildAccessCookieOptions() {
  return {
    name: ACCESS_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  };
}

export function buildRefreshCookieOptions(rememberMe = false) {
  return {
    name: REFRESH_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/api/v1/auth',
    maxAge: rememberMe ? JWT_REMEMBER_MAX_AGE : JWT_DEFAULT_MAX_AGE,
  };
}
