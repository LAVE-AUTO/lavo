import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

/** Matches YYYY-MM-DD strings. Does not validate calendar correctness (Zod handles coercion to Date). */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

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
 */
export const dashboardQuerySchema = z
  .object({
    period: z.coerce.number().int().min(1, 'period must be at least 1').max(365, 'period must be at most 365').optional(),
    from: dateStringSchema.optional(),
    to: dateStringSchema.optional(),
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

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

/**
 * Resolves the effective date range from validated dashboard query params.
 *
 * Priority:
 *   1. `from` + `to` present → use exact range provided
 *   2. `period` present      → from = now - period days, to = now
 *   3. Default               → 30-day window ending now
 *
 * @returns { from: Date, to: Date, days: number }
 */
export function resolveDateRange(parsed: DashboardQuery): { from: Date; to: Date; days: number } {
  const now = new Date();

  if (parsed.from !== undefined && parsed.to !== undefined) {
    const from = new Date(parsed.from);
    const to = new Date(parsed.to);
    // Set `to` to end of day so the full day is included
    to.setUTCHours(23, 59, 59, 999);
    const diffMs = to.getTime() - from.getTime();
    const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { from, to, days };
  }

  const days = parsed.period ?? 30;
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - days);
  from.setUTCHours(0, 0, 0, 0);
  const to = new Date(now);
  return { from, to, days };
}
