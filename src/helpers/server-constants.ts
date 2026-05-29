/**
 * Server-only constants.
 *
 * This module is restricted to server-side code (src/app/api/, src/server/, src/lib/).
 * It must NOT be imported by any client component (src/components/, src/context/, src/services/).
 * The 'server-only' import enforces this at build time.
 *
 * All values fall back to safe production defaults when the env var is absent.
 */
import 'server-only';

// ─── Auth / JWT ───────────────────────────────────────────────────────────────

export const ACCESS_COOKIE_NAME  = process.env.ACCESS_COOKIE_NAME  ?? 'access_token';
export const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? 'refresh_token';

/** Access token lifetime in seconds (default 15 min). */
export const ACCESS_TOKEN_MAX_AGE = parseInt(process.env.ACCESS_TOKEN_TTL_SECONDS ?? String(15 * 60), 10);
/** Express-style string form derived from ACCESS_TOKEN_MAX_AGE. */
export const ACCESS_TOKEN_EXPIRY  = `${Math.round(ACCESS_TOKEN_MAX_AGE / 60)}m`;

/** Default JWT lifetime in seconds (default 1 day). */
export const JWT_DEFAULT_MAX_AGE  = parseInt(process.env.JWT_DEFAULT_TTL_SECONDS  ?? String(24 * 60 * 60), 10);
/** Remember-me JWT lifetime in seconds (default 30 days). */
export const JWT_REMEMBER_MAX_AGE = parseInt(process.env.JWT_REMEMBER_TTL_SECONDS ?? String(30 * 24 * 60 * 60), 10);

export const JWT_DEFAULT_EXPIRY  = `${Math.round(JWT_DEFAULT_MAX_AGE  / 3600)}h`;
export const JWT_REMEMBER_EXPIRY = `${Math.round(JWT_REMEMBER_MAX_AGE / 86400)}d`;

// ─── Password hashing ─────────────────────────────────────────────────────────

/** bcrypt cost factor — minimum enforced value is 12; lower values are unsafe in production. */
export const BCRYPT_ROUNDS = Math.max(12, parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10));

// ─── Token TTLs ───────────────────────────────────────────────────────────────

/** Email verification token lifetime in milliseconds (default 24 h). */
export const EMAIL_VERIFICATION_TTL_MS = parseInt(process.env.EMAIL_VERIFICATION_TTL_HOURS ?? '24', 10) * 60 * 60 * 1000;

/** Password reset token lifetime in milliseconds (default 60 min). */
export const PASSWORD_RESET_TTL_MS = parseInt(process.env.PASSWORD_RESET_TTL_MINUTES ?? '60', 10) * 60 * 1000;

/** Admin OTP lifetime in milliseconds (default 10 min). */
export const OTP_TTL_MS = parseInt(process.env.OTP_TTL_MINUTES ?? '10', 10) * 60 * 1000;

// ─── Rate limiting ────────────────────────────────────────────────────────────

/** Max failed login attempts before the account is locked. */
export const RATE_LIMIT_MAX_ATTEMPTS  = parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS  ?? '5',  10);
/** Lock duration in minutes after RATE_LIMIT_MAX_ATTEMPTS failures. */
export const RATE_LIMIT_BLOCK_MINUTES = parseInt(process.env.RATE_LIMIT_BLOCK_MINUTES ?? '15', 10);

/** Max OTP requests per admin within the window (default 3). */
export const OTP_RATE_LIMIT_MAX     = parseInt(process.env.OTP_RATE_LIMIT_MAX             ?? '3',  10);
/** OTP rate-limit window in milliseconds (default 5 min). */
export const OTP_RATE_LIMIT_WINDOW_MS = parseInt(process.env.OTP_RATE_LIMIT_WINDOW_MINUTES ?? '5', 10) * 60 * 1000;

// ─── Business defaults ────────────────────────────────────────────────────────

/** Default platform commission rate applied to reservations (10%). */
export const DEFAULT_COMMISSION_RATE = process.env.PLATFORM_COMMISSION_RATE ?? '0.1000';

/**
 * Default platform currency for all Stripe operations (PaymentIntents and tips).
 * Stripe currency codes are 3-letter ISO 4217 strings, lowercase.
 * Overridable per deployment via PLATFORM_CURRENCY; defaults to CAD (Canadian Dollar),
 * the actual operating currency for Hurryline. Every connected station's Stripe Connect
 * account must accept this currency.
 */
export const DEFAULT_PLATFORM_CURRENCY = (process.env.PLATFORM_CURRENCY ?? 'cad').trim().toLowerCase();
