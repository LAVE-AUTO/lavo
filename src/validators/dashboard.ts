import { z } from 'zod';
import { mapZodErrors, dateStringSchema, refineDateRange } from './shared';

export { mapZodErrors };

/**
 * Zod schema for GET /api/v1/admin/dashboard query parameters.
 *
 * Accepted combinations:
 *   - No params              → default 30-day window ending now
 *   - ?period=N              → N-day window ending now (1 ≤ N ≤ 365)
 *   - ?from=YYYY-MM-DD&to=YYYY-MM-DD → exact date range
 *
 * Cross-field rules:
 *   - `from` without `to` → error
 *   - `to` without `from` → error
 *   - `from` > `to`       → error
 *   - date range > 365 days → error
 *   - `period` and `from`/`to` together → error (mutually exclusive)
 */
export const dashboardQuerySchema = z
  .object({
    period: z.coerce.number().int().min(1, 'period must be at least 1').max(365, 'period must be at most 365').optional(),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.period !== undefined && (data.from !== undefined || data.to !== undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '`period` and `from`/`to` are mutually exclusive',
        path: ['period'],
      });
      return;
    }
    refineDateRange(data, ctx);
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/**
 * Resolves the effective date range from validated dashboard query params.
 *
 * Priority:
 *   1. `from` + `to` present → use exact range provided
 *   2. `period` present      → from = now - period days, to = now
 *   3. Default               → 30-day window ending now
 *
 * Dates are normalized to full days using UTC:
 *   - `from` is set to 00:00:00.000 UTC.
 *   - `to` is set to 23:59:59.999 UTC.
 *
 * @param parsed - Validated dashboard query parameters.
 * @returns      - Effective date range and inclusive day count.
 */
export function resolveDateRange(parsed: DashboardQuery): { from: Date; to: Date; days: number } {
  const now = new Date();

  // Branch 1: explicit from/to range provided.
  if (parsed.from !== undefined && parsed.to !== undefined) {
    const from = new Date(parsed.from);
    from.setUTCHours(0, 0, 0, 0);

    const to = new Date(parsed.to);
    // Compute days from raw string dates before mutating `to` to avoid off-by-one.
    // +1 makes the count inclusive of both endpoints (e.g. Jan 1 to Jan 1 = 1 day).
    const days = Math.round((new Date(parsed.to).getTime() - new Date(parsed.from).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    // Set `to` to end of day so the full day is included in DB range queries.
    to.setUTCHours(23, 59, 59, 999);
    return { from, to, days };
  }

  // Branch 2: period-based or default.
  const days = parsed.period ?? 30;
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to, days };
}
