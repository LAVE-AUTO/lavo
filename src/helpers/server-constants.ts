/**
 * Server-only constants.
 *
 * This module is restricted to server-side code (src/app/api/, src/server/, src/lib/).
 * It must NOT be imported by any client component (src/components/, src/context/, src/services/).
 * The 'server-only' import enforces this at build time.
 */
import 'server-only';

export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';
export const ACCESS_TOKEN_EXPIRY = '15m';
export const ACCESS_TOKEN_MAX_AGE = 15 * 60;
export const JWT_DEFAULT_EXPIRY = '1d';
export const JWT_REMEMBER_EXPIRY = '30d';
export const JWT_DEFAULT_MAX_AGE = 24 * 60 * 60;
export const JWT_REMEMBER_MAX_AGE = 30 * 24 * 60 * 60;
export const RATE_LIMIT_MAX_ATTEMPTS = 5;
export const RATE_LIMIT_BLOCK_MINUTES = 15;

/** Default platform commission rate applied to reservations (10%). */
export const DEFAULT_COMMISSION_RATE = '0.1000';
