import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

// ─── Shared param schemas ─────────────────────────────────────────────────────

export const disputeIdParamSchema = z.string().uuid('Invalid dispute ID format');

// ─── Client: create dispute ───────────────────────────────────────────────────

// SECURITY: .strict() rejects unknown keys; .trim() prevents whitespace-only strings
export const createDisputeSchema = z.object({
  reservation_id: z.string().uuid('Invalid reservation ID format'),
  reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason must not exceed 500 characters'),
  description: z.string().trim().max(2000, 'Description must not exceed 2000 characters').optional(),
  requested_amount: z
    .number({ invalid_type_error: 'requested_amount must be a number' })
    .positive('Requested amount must be greater than 0')
    .max(100_000, 'Requested amount exceeds maximum')
    .transform((v) => Math.round(v * 100) / 100)
    .optional(),
}).strict();

export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;

// ─── Admin: refund dispute ────────────────────────────────────────────────────

export const refundDisputeSchema = z.object({
  amount: z
    .number({ invalid_type_error: 'amount must be a number' })
    .positive('Refund amount must be greater than 0')
    .max(100_000, 'Refund amount exceeds maximum')
    .transform((v) => Math.round(v * 100) / 100)
    .optional(),
}).strict();

export type RefundDisputeInput = z.infer<typeof refundDisputeSchema>;

// ─── Admin: close dispute ─────────────────────────────────────────────────────

export const closeDisputeSchema = z.object({
  status: z.enum(['resolved', 'rejected'], {
    required_error: 'status is required',
    invalid_type_error: 'status must be "resolved" or "rejected"',
  }),
  reason: z.string().trim().min(1, 'Reason is required').max(500, 'Reason must not exceed 500 characters'),
}).strict();

export type CloseDisputeInput = z.infer<typeof closeDisputeSchema>;

// ─── Admin: list disputes query ───────────────────────────────────────────────

export const listDisputesQuerySchema = z.object({
  status: z.enum(['open', 'refunded', 'resolved', 'rejected']).optional(),
  station_id: z.string().uuid('Invalid station_id format').optional(),
  client_id: z.string().uuid('Invalid client_id format').optional(),
  date_from: z.string().datetime({ offset: true, message: 'date_from must be an ISO 8601 datetime' }).optional(),
  date_to: z.string().datetime({ offset: true, message: 'date_to must be an ISO 8601 datetime' }).optional(),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1, 'page must be at least 1')),
  per_page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100, 'per_page must not exceed 100')),
}).refine(
  (data) => {
    if (data.date_from && data.date_to) {
      return new Date(data.date_from) <= new Date(data.date_to);
    }
    return true;
  },
  { message: 'date_from must be earlier than or equal to date_to' }
);

export type ListDisputesQuery = z.infer<typeof listDisputesQuerySchema>;
