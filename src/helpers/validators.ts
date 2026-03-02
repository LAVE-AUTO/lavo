import {
  MIN_USERNAME_LENGTH,
  DEFAULT_MAX_TEXT_FIELD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from './constants';

/**
 * Validates text using regex pattern with length constraints.
 *
 * @param text - The text to validate
 * @param regex - Optional regex pattern
 * @param minLength - Minimum length
 * @param maxLength - Maximum length
 * @returns True if valid
 */
export function validateText(
  text: string | null | undefined,
  regex: RegExp | string | null = null,
  minLength = MIN_USERNAME_LENGTH,
  maxLength = DEFAULT_MAX_TEXT_FIELD_LENGTH
): boolean {
  if (!text || typeof text !== 'string') return false;

  const trimmed = text.trim();
  if (trimmed.length < minLength || trimmed.length > maxLength) {
    return false;
  }

  if (regex) {
    const pattern = typeof regex === 'string' ? new RegExp(regex) : regex;
    return pattern.test(trimmed);
  }

  return true;
}

/**
 * Validates email format (RFC-compliant basic check).
 *
 * @param email - The email to validate
 * @returns True if valid format
 */
export function validateEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates password meets minimum security requirements.
 *
 * @param password - The password to validate
 * @param minLength - Minimum length (default 8)
 * @returns True if valid
 */
export function validatePassword(
  password: string | null | undefined,
  minLength = MIN_PASSWORD_LENGTH
): boolean {
  if (!password || typeof password !== 'string') return false;
  return password.length >= minLength;
}

/**
 * Validates number format and optional constraints.
 *
 * @param value - The value to validate
 * @param regex - Optional regex pattern
 * @returns True if valid
 */
export function validateNumber(
  value: string | number | null | undefined,
  regex: RegExp | string | null = null
): boolean {
  const defaultRegex = /^[0-9.]+$/;
  const pattern = regex
    ? typeof regex === 'string'
      ? new RegExp(regex)
      : regex
    : defaultRegex;
  return pattern.test(String(value ?? ''));
}
