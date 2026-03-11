import {
  MIN_USERNAME_LENGTH,
  DEFAULT_MAX_TEXT_FIELD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from './constants';
import { isValidPhoneNumber } from 'libphonenumber-js';
import { getCountryCallingCode, type Country } from 'react-phone-number-input';

const ALLOWED_SPECIAL_CHARS = /[@$!%*#?&_\-+=]/;
const ALLOWED_PASSWORD_CHARS = /^[A-Za-z0-9@$!%*#?&_\-+=]+$/;
const NAME_REGEX = /^[a-zA-Z\u00C0-\u017F]([a-zA-Z\u00C0-\u017F' -]*[a-zA-Z\u00C0-\u017F])?$/;

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

/**
 * Returns an object indicating which password rules are satisfied.
 */
export function validatePasswordStrength(password: string): {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  validChars: boolean;
} {
  return {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: ALLOWED_SPECIAL_CHARS.test(password),
    validChars: ALLOWED_PASSWORD_CHARS.test(password),
  };
}

/**
 * Returns true if the password meets all strength requirements.
 */
export function isPasswordValid(password: string | null | undefined): boolean {
  if (!password) return false;
  const s = validatePasswordStrength(password);
  return s.minLength && s.hasUpper && s.hasLower && s.hasNumber && s.hasSpecial && s.validChars;
}

/**
 * Validates a name (first or last).
 * Must be 2-50 chars, start/end with a letter, only letters/spaces/hyphens/apostrophes.
 */
export function validateName(name: string | null | undefined): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 50) return false;
  if (/^\d+$/.test(trimmed)) return false;
  if (/\s{2,}/.test(trimmed)) return false;
  const letterCount = (trimmed.match(/[a-zA-Z\u00C0-\u017F]/g) || []).length;
  if (letterCount < 2) return false;
  return NAME_REGEX.test(trimmed);
}

/**
 * Validates a phone number using libphonenumber-js (same library as server-side).
 */
export function validatePhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  const trimmed = phone.trim();
  if (!trimmed) return false;
  return isValidPhoneNumber(trimmed);
}

/**
 * Joins a country code and a local number into a full E.164 phone string.
 */
export function joinPhoneNumber(country: Country, localNumber: string): string {
  const digits = localNumber.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const dialCode = getCountryCallingCode(country);
  return `+${dialCode}${digits}`;
}
