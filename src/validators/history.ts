/**
 * Zod schemas for history API endpoints.
 */
import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

function isValidCalendarDate(s: string): boolean {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
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
    status: z.string().max(30).optional(),
    amount_min: z
      .string()
      .optional()
      .transform((s) => (s ? parseFloat(s) : undefined))
      .refine(
        (n) => n === undefined || (typeof n === 'number' && !Number.isNaN(n) && n >= 0),
        { message: 'amount_min must be a non-negative number' }
      ),
    amount_max: z
      .string()
      .optional()
      .transform((s) => (s ? parseFloat(s) : undefined))
      .refine(
        (n) => n === undefined || (typeof n === 'number' && !Number.isNaN(n) && n >= 0),
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
