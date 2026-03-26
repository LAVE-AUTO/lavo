import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

export const updateCommissionSchema = z.object({
  /**
   * New commission rate as a decimal fraction (e.g. 0.1 = 10%).
   * Must be in ]0, 1].
   * Stored with 4 decimal places.
   */
  rate: z
    .number({ invalid_type_error: 'rate must be a number' })
    .positive('Rate must be greater than 0')
    .max(1, 'Rate must not exceed 1 (100%)')
    .transform((v) => Math.round(v * 10000) / 10000),
});

export type UpdateCommissionInput = z.infer<typeof updateCommissionSchema>;

export const commissionHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export const transactionLogsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
  /** Filter by LAVO business type. */
  type: z.enum(['reservation', 'tip', 'penalty']).optional(),
  /** Filter by station UUID. */
  station_id: z.string().uuid('Invalid station ID').optional(),
  /** ISO date-time string — lower bound on created_at. */
  date_from: z.coerce.date().optional(),
  /** ISO date-time string — upper bound on created_at. */
  date_to: z.coerce.date().optional(),
});

export type TransactionLogsQuery = z.infer<typeof transactionLogsQuerySchema>;
