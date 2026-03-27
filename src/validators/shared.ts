import { z } from 'zod';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';
import type { ApiErrorBody } from '@/types/api';

/**
 * Validates and normalizes a phone number to E.164 format (e.g. +14165551234).
 * Expects the frontend to send the full international number with country code prefix.
 *
 * Uses libphonenumber-js for robust international phone number validation.
 * Output is always normalized to E.164 format for storage and API use.
 */
export const phoneSchema = z
  .string()
  .min(1, 'Phone number is required')
  .refine((val) => isValidPhoneNumber(val), {
    message: 'Invalid phone number',
  })
  .transform((val) => parsePhoneNumber(val).format('E.164'));

/**
 * Maps a ZodError to the project's standard API error shape.
 * Defined here (not in auth.ts) so non-auth validators can import it
 * without creating an indirect dependency on the auth module.
 *
 * Flattens nested field paths using dot notation (e.g., "user.email").
 *
 * @param err - The ZodError from a failed validation.
 * @returns   - Array of field-message pairs matching ApiErrorBody['errors'].
 */
export function mapZodErrors(
  err: z.ZodError
): NonNullable<ApiErrorBody['errors']> {
  return err.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
}

/**
 * Validates YYYY-MM-DD strings.
 * The regex checks the format; the refine ensures the date is a real calendar date
 * by parsing it and verifying the UTC components round-trip back to the same string
 * (catches overflow cases like 2026-02-30 → 2026-03-02).
 */
export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine(
    (val) => {
      const d = new Date(val);
      if (isNaN(d.getTime())) return false;
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}` === val;
    },
    { message: 'Date must be a valid calendar date' }
  )
  .refine(
    (val) => {
      const year = parseInt(val.slice(0, 4), 10);
      return year >= 2000 && year <= 2100;
    },
    { message: 'Date year must be between 2000 and 2100' }
  );

/**
 * Adds cross-field validation rules for an optional from/to date pair:
 * - `from` without `to` → error
 * - `to` without `from` → error
 * - `from` > `to`       → error
 * - date range > 365 days → error
 *
 * Designed for use inside `.superRefine()` on a Zod object that has
 * optional `from` and `to` string fields.
 */
export function refineDateRange(
  data: { from?: string; to?: string },
  ctx: z.RefinementCtx
): void {
  const hasFrom = data.from !== undefined;
  const hasTo = data.to !== undefined;

  if (hasFrom && !hasTo) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '`to` is required when `from` is provided',
      path: ['to'],
    });
    return;
  }

  if (hasTo && !hasFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: '`from` is required when `to` is provided',
      path: ['from'],
    });
    return;
  }

  if (hasFrom && hasTo) {
    const fromDate = new Date(data.from!);
    const toDate = new Date(data.to!);
    if (fromDate > toDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`from` must not be after `to`',
        path: ['from'],
      });
    }
    const diffDays = Math.ceil(
      (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 364) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date range must not exceed 365 days',
        path: ['from'],
      });
    }
  }
}

/**
 * Formats a Date as a YYYY-MM-DD string using UTC components.
 * Avoids locale-dependent output from toLocaleDateString().
 *
 * @param date - The Date object to format.
 * @returns    - Formatted string in YYYY-MM-DD format.
 */
export function formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
