import { SignJWT, jwtVerify } from 'jose';
import {
  AUTH_COOKIE_NAME,
  JWT_DEFAULT_EXPIRY,
  JWT_REMEMBER_EXPIRY,
  JWT_DEFAULT_MAX_AGE,
  JWT_REMEMBER_MAX_AGE,
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

export async function signJwt(
  payload: JwtPayload,
  rememberMe = false
): Promise<string> {
  const expiry = rememberMe ? JWT_REMEMBER_EXPIRY : JWT_DEFAULT_EXPIRY;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
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

export function buildCookieOptions(rememberMe = false) {
  return {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: rememberMe ? JWT_REMEMBER_MAX_AGE : JWT_DEFAULT_MAX_AGE,
  };
}
