/**
 * Application-wide constants.
 */

export const APP_NAME = 'LAVO';
export const APP_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) ||
  'http://localhost:3000';

export const API_BASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  '/api/v1';
export const API_TIMEOUT = 30000;

export const MIN_PASSWORD_LENGTH = 8;
export const MAX_TEXT_LENGTH = 500;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;
/** Default max length for generic short text fields (e.g. validateText). */
export const DEFAULT_MAX_TEXT_FIELD_LENGTH = 50;
/** Default max length for truncateText when not specified. */
export const DEFAULT_TRUNCATE_LENGTH = 150;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
} as const;

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
