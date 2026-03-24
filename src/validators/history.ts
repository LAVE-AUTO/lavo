/**
 * Zod schemas for history API endpoints.
 */
import { z } from 'zod';
import { mapZodErrors } from './auth';
import { isValidCalendarDate } from '@/helpers/date-helper';

export { mapZodErrors };

const CLIENT_HISTORY_ALLOWED_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled'] as const;
const STATION_HISTORY_ALLOWED_STATUSES = [
  'pending_payment',
  'pending',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
] as const;
const CLIENT_HISTORY_ALLOWED_ENTRY_TYPES = ['reservation', 'queue'] as const;
const STRICT_DECIMAL_REGEX = /^\d+(?:\.\d+)?$/;

function splitCsvValues(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseStrictNonNegativeDecimal(input?: string): number | undefined {
  if (input === undefined) return undefined;
  const trimmed = input.trim();
  if (trimmed.length === 0) return undefined;
  if (!STRICT_DECIMAL_REGEX.test(trimmed)) return Number.NaN;
  return Number.parseFloat(trimmed);
}

function sanitizeHistoryQueryText(input?: string): string | undefined {
  if (input === undefined) return undefined;
  const sanitized = input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return sanitized.length > 0 ? sanitized : undefined;
}

/** Query params for GET /api/v1/history/station */
export const stationHistoryQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((s) => (s ? parseInt(s, 10) : undefined))
      .refine((n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 10_000), {
        message: 'page must be an integer between 1 and 10000',
      }),
    limit: z
      .string()
      .optional()
      .transform((s) => (s ? parseInt(s, 10) : undefined))
      .refine((n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 100), {
        message: 'limit must be an integer between 1 and 100',
      }),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'from must be a valid calendar date' })
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'to must be a valid calendar date' })
      .optional(),
    status: z.enum(STATION_HISTORY_ALLOWED_STATUSES).optional(),
    amount_min: z
      .string()
      .optional()
      .transform(parseStrictNonNegativeDecimal)
      .refine(
        (n) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= 0),
        { message: 'amount_min must be a non-negative number' }
      ),
    amount_max: z
      .string()
      .optional()
      .transform(parseStrictNonNegativeDecimal)
      .refine(
        (n) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= 0),
        { message: 'amount_max must be a non-negative number' }
      ),
  })
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;
      return data.from <= data.to;
    },
    { message: 'from must be before or equal to to', path: ['from'] }
  )
  .refine(
    (data) => {
      if (data.amount_min === undefined || data.amount_max === undefined) return true;
      return data.amount_min <= data.amount_max;
    },
    { message: 'amount_min must be less than or equal to amount_max', path: ['amount_min'] }
  );

export type StationHistoryQuery = z.infer<typeof stationHistoryQuerySchema>;

export const clientHistoryQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((s) => (s ? parseInt(s, 10) : undefined))
      .refine((n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 10_000), {
        message: 'page must be an integer between 1 and 10000',
      }),
    limit: z
      .string()
      .optional()
      .transform((s) => (s ? parseInt(s, 10) : undefined))
      .refine((n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 100), {
        message: 'limit must be an integer between 1 and 100',
      }),
    status: z
      .array(z.string())
      .optional()
      .transform((values) => {
        if (!values || values.length === 0) return undefined;
        const split = splitCsvValues(values).map((value) => value.toLowerCase());
        const deduped = Array.from(new Set(split));
        return deduped.length > 0 ? deduped : undefined;
      })
      .refine(
        (values) =>
          values === undefined ||
          values.every((value) =>
            (CLIENT_HISTORY_ALLOWED_STATUSES as readonly string[]).includes(value)
          ),
        {
          message: `status must be one of: ${CLIENT_HISTORY_ALLOWED_STATUSES.join(', ')}`,
        }
      ),
    entry_type: z.enum(CLIENT_HISTORY_ALLOWED_ENTRY_TYPES).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'from must be a valid calendar date' })
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'to must be a valid calendar date' })
      .optional(),
    amount_min: z
      .string()
      .optional()
      .transform(parseStrictNonNegativeDecimal)
      .refine(
        (n) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= 0),
        { message: 'amount_min must be a non-negative number' }
      ),
    amount_max: z
      .string()
      .optional()
      .transform(parseStrictNonNegativeDecimal)
      .refine(
        (n) => n === undefined || (typeof n === 'number' && Number.isFinite(n) && n >= 0),
        { message: 'amount_max must be a non-negative number' }
      ),
    q: z
      .string()
      .optional()
      .transform(sanitizeHistoryQueryText)
      .refine((s) => s === undefined || s.length <= 100, {
        message: 'q must be at most 100 characters',
      }),
    sort_by: z.enum(['created_at', 'amount_paid', 'status']).optional().default('created_at'),
    sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
  })
  .refine(
    (data) => {
      if (!data.from || !data.to) return true;
      return data.from <= data.to;
    },
    { message: 'from must be before or equal to to', path: ['from'] }
  )
  .refine(
    (data) => {
      if (data.amount_min === undefined || data.amount_max === undefined) return true;
      return data.amount_min <= data.amount_max;
    },
    { message: 'amount_min must be less than or equal to amount_max', path: ['amount_min'] }
  );

export const clientHistoryReceiptParamSchema = z.object({
  entryId: z.string().uuid('entryId must be a valid UUID'),
});

export type StationHistoryAllowedStatus = (typeof STATION_HISTORY_ALLOWED_STATUSES)[number];
export type ClientHistoryQuery = z.infer<typeof clientHistoryQuerySchema>;
export type ClientHistoryAllowedStatus = (typeof CLIENT_HISTORY_ALLOWED_STATUSES)[number];
