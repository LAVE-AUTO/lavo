import { z } from 'zod';

import { mapZodErrors, dateStringSchema, refineDateRange } from './shared';

export { mapZodErrors };


// %%%%% Constants %%%%%
// Supported station metrics

/**
 * Supported metric slugs for GET /api/v1/station/analytics/[metric].
 */
export const STATION_METRICS = ['revenue', 'clients', 'completed'] as const;

export type StationMetricSlug = (typeof STATION_METRICS)[number];


// %%%%% Validation schemas %%%%%
// Query parameter validation for analytics endpoints

/**
 * Zod schema for GET /api/v1/station/analytics/[metric] query parameters.
 *
 * Accepted combinations:
 *   - No params                           → default 30-day window ending today
 *   - ?from=YYYY-MM-DD&to=YYYY-MM-DD      → exact date range (both required if either is provided)
 *
 * Cross-field rules (delegated to refineDateRange):
 *   - `from` without `to` → error
 *   - `to` without `from` → error
 *   - `from` > `to`       → error
 *   - date range > 365 days → error
 */
export const stationAnalyticsQuerySchema = z
  .object({
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  })
  .strict()
  .superRefine(refineDateRange);

export type StationAnalyticsQuery = z.infer<typeof stationAnalyticsQuerySchema>;


// %%%%% Range resolution %%%%%
// Determine effective date range from query parameters

/**
 * Resolves the effective date range from validated station analytics query params.
 *
 * Priority:
 *   1. `from` + `to` present → use exact range provided
 *   2. Default               → 30-day window ending today
 *
 * `from` is set to start of day (UTC); `to` is set to end of day (UTC)
 * so the full boundary days are included in database range queries.
 *
 * @param parsed - Validated analytics query parameters.
 * @returns      - Effective date range (from and to as Date objects).
 */
export function resolveStationAnalyticsRange(
  parsed: StationAnalyticsQuery
): { from: Date; to: Date } {
  if (parsed.from !== undefined && parsed.to !== undefined) {
    const from = new Date(parsed.from);
    from.setUTCHours(0, 0, 0, 0);

    const to = new Date(parsed.to);
    to.setUTCHours(23, 59, 59, 999);
    return { from, to };
  }

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 29);
  from.setUTCHours(0, 0, 0, 0);

  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}
