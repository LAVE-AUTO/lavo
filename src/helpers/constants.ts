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
export const MAX_PASSWORD_LENGTH = 128;
export const MAX_TEXT_LENGTH = 500;
export const MIN_USERNAME_LENGTH = 3;
export const MAX_USERNAME_LENGTH = 30;
/** Default max length for generic short text fields (e.g. validateText). */
export const DEFAULT_MAX_TEXT_FIELD_LENGTH = 50;
/** Default max length for truncateText when not specified. */
export const DEFAULT_TRUNCATE_LENGTH = 150;

export const SUPPORT_SUBJECT_MIN_LENGTH = 5;
export const SUPPORT_SUBJECT_MAX_LENGTH = 255;
export const SUPPORT_MESSAGE_MIN_LENGTH = 10;
export const SUPPORT_MESSAGE_MAX_LENGTH = 2000;

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
/** Max size for station application documents (images + PDF). */
export const STATION_DOC_MAX_SIZE = 10 * 1024 * 1024; // 10MB
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
/** MIME types allowed for station documents (onboarding). */
export const ALLOWED_DOCUMENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
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
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
} as const;

// SERVER-ONLY constants have been moved to src/helpers/server-constants.ts.
// Do NOT import them here. Use '@/helpers/server-constants' in server-side code only.

/**
 * Maximum number of days in advance a reservation can be booked.
 * Stripe card authorizations expire after 7 days — bookings beyond this window
 * would result in an expired authorization before service completion.
 */
export const MAX_ADVANCE_BOOKING_DAYS = 7;
