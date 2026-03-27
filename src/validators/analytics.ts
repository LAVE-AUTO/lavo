import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

/** All valid metric slug values for the analytics timeseries endpoints. */
export const VALID_METRICS = [
  'transactions',
  'revenue',
  'commissions',
  'registrations',
  'stations',
  'reservations',
  'cancellations',
  'support-tickets',
  'avg-rating',
] as const;

export type MetricSlug = (typeof VALID_METRICS)[number];

/** Matches YYYY-MM-DD strings. Does not validate calendar correctness. */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * Zod schema for GET /api/v1/admin/analytics/[metric] query parameters.
 *
 * Accepted combinations:
 *   - No params                           → default 30-day window ending now
 *   - ?from=YYYY-MM-DD&to=YYYY-MM-DD      → exact date range
 *
 * Cross-field rules:
 *   - `from` without `to` → error
 *   - `to` without `from` → error
 *   - `from` > `to`       → error
 */
export const analyticsQuerySchema = z
  .object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
  })
  .superRefine((data, ctx) => {
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
      const diffMs = toDate.getTime() - fromDate.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays > 365) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Date range must not exceed 365 days',
          path: ['from'],
        });
      }
    }
  });

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

/**
 * Resolves the effective date range from validated analytics query params.
 *
 * Priority:
 *   1. `from` + `to` present → use exact range provided
 *   2. Default               → 30-day window ending now
 *
 * `from` is set to start of day (UTC); `to` is set to end of day (UTC)
 * so the full boundary days are included.
 *
 * @returns { from: Date, to: Date }
 */
export function resolveAnalyticsRange(parsed: AnalyticsQuery): { from: Date; to: Date } {
  if (parsed.from !== undefined && parsed.to !== undefined) {
    const from = new Date(parsed.from);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(parsed.to);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 30);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}
