import { DEFAULT_TRUNCATE_LENGTH } from './constants';

/**
 * Truncates text to maximum length with ellipsis.
 *
 * @param text - The text to truncate
 * @param maxLength - Maximum length before truncation
 * @returns Truncated string
 */
export function truncateText(
  text: string | null | undefined,
  maxLength = DEFAULT_TRUNCATE_LENGTH
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

/**
 * Capitalizes first letter of string.
 *
 * @param str - The string to capitalize
 * @returns Capitalized string
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Converts string to URL-friendly slug.
 *
 * @param str - The string to slugify
 * @returns URL-friendly slug
 */
export function slugify(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
