import { z } from 'zod';
import { mapZodErrors, dateStringSchema, refineDateRange } from './shared';

export { mapZodErrors };

/**
 * All valid metric slug values for the analytics timeseries endpoints.
 * Each metric maps to a specific repository function that returns a sparse timeseries.
 */
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

/**
 * Zod schema for GET /api/v1/admin/analytics/[metric] query parameters.
 *
 * Accepted combinations:
 *   - No params                           → default 30-day window ending now, group_by=day
 *   - ?from=YYYY-MM-DD&to=YYYY-MM-DD      → exact date range, group_by=day
 *   - ?group_by=day|week|month            → granularity for grouping (default: day)
 *
 * Cross-field rules:
 *   - `from` without `to` → error
 *   - `to` without `from` → error
 *   - `from` > `to`       → error
 *   - date range > 365 days → error
 */
export const analyticsQuerySchema = z
  .object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
    group_by: z.enum(['day', 'week', 'month']).default('day'),
  })
  .strict()
  .superRefine(refineDateRange);

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

/**
 * Resolves the effective date range from validated analytics query params.
 *
 * Priority:
 *   1. `from` + `to` present → use exact range provided
 *   2. Default               → 30-day window ending now
 *
 * `from` is set to start of day (UTC); `to` is set to end of day (UTC)
 * so the full boundary days are included in database range queries.
 *
 * @param parsed - Validated analytics query parameters.
 * @returns      - Effective date range (from and to as Date objects).
 */
export function resolveAnalyticsRange(parsed: AnalyticsQuery): { from: Date; to: Date } {
  // Branch 1: explicit from/to range provided.
  if (parsed.from !== undefined && parsed.to !== undefined) {
    const from = new Date(parsed.from);
    from.setUTCHours(0, 0, 0, 0);

    const to = new Date(parsed.to);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  // Branch 2: default 30-day window.
  // Subtract 29 (not 30) so the range is 30 inclusive days: today-29 through today.
  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}
