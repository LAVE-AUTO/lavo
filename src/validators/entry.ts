/**
 * Zod schemas for reservation and queue (entry) API request bodies and params.
 */
import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

const uuidSchema = z.string().uuid('Must be a valid UUID');
const qrTokenSchema = z
  .string()
  .trim()
  .regex(/^[a-f0-9]{64}$/i, 'qr_token must be a 64-character hexadecimal signature');
const qrVersionSchema = z.literal('1', {
  errorMap: () => ({ message: 'v must be "1"' }),
});

/** Path param: entry id (for PATCH me/entries/:entryId/cancel, POST upgrade-to-reservation, PATCH station/entries/:entryId). */
export const entryIdParamSchema = z.object({
  entryId: z.string().uuid('Invalid entry id'),
});

/** Path param: reservation id (for POST /reservations/:id/cancel). */
export const reservationIdParamSchema = z.object({
  id: z.string().uuid('Invalid reservation id'),
});

/** POST /reservations/:id/cancel - optional cancellation reason. */
export const cancelReservationBodySchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

/** POST /stations/:id/reservations - create reservation. */
export const createReservationBodySchema = z
  .object({
    time_slot_id: uuidSchema,
    vehicle_format_id: uuidSchema,
    qr_token: qrTokenSchema.optional(),
    v: qrVersionSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    const hasToken = typeof data.qr_token === 'string';
    const hasVersion = typeof data.v === 'string' && data.v.length > 0;
    if (hasToken !== hasVersion) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'qr_token and v must be provided together',
        path: hasToken ? ['v'] : ['qr_token'],
      });
    }
  });

/** POST /stations/:id/queue/join - join queue. */
export const joinQueueBodySchema = z
  .object({
    vehicle_format_id: uuidSchema,
  })
  .strict();

/** PATCH /me/entries/:entryId/cancel - optional cancellation reason (used for confirmed reservations). */
export const cancelEntryBodySchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict()
  .optional();

/** POST /me/entries/:entryId/upgrade-to-reservation - upgrade queue to reservation. */
export const upgradeToReservationBodySchema = z
  .object({
    time_slot_id: uuidSchema,
  })
  .strict();

/** PATCH /station/entries/:entryId - set status (in_progress, completed, cancelled). */
export const stationPatchEntryBodySchema = z
  .object({
    status: z.enum(['in_progress', 'completed', 'cancelled'], {
      errorMap: () => ({ message: 'status must be in_progress, completed, or cancelled' }),
    }),
  })
  .strict();

/** POST /reservations/:id/reschedule - new time slot id. */
export const rescheduleBodySchema = z
  .object({
    new_time_slot_id: z.string().uuid('new_time_slot_id must be a valid UUID'),
  })
  .strict();

/** POST /reservations/:id/signal-delay - optional client message. */
export const signalDelayBodySchema = z
  .object({
    message: z.string().max(500).optional(),
  })
  .strict()
  .optional();

/** POST /reservations/:id/refuse-delay - optional refusal reason. */
export const refuseDelayBodySchema = z
  .object({
    refusal_reason: z.string().max(500).optional(),
  })
  .strict()
  .optional();

/** PATCH /station/entries/:entryId/position - reorder queue. */
export const stationPatchPositionBodySchema = z
  .object({
    queue_position: z.number().int().min(1, 'queue_position must be at least 1'),
  })
  .strict();

/** POST /station/extra-time - add overrun time to a reservation and cascade-shift subsequent slots. */
export const extraTimeBodySchema = z
  .object({
    reservation_id: uuidSchema,
    // Upper bound mirrors MAX_EXTRA_MINUTES in extra-time-service (defense in depth). 480 minutes
    // (8 hours) is higher than any legitimate wash overrun and low enough that SQL interval math
    // cannot flip calendar dates or cascade-shift the rest of the day off-schedule.
    extra_minutes: z
      .number({ invalid_type_error: 'extra_minutes must be a number' })
      .int('extra_minutes must be an integer')
      .positive('extra_minutes must be a positive integer')
      .max(480, 'extra_minutes cannot exceed 480'),
  })
  .strict();

export type ExtraTimeBody = z.infer<typeof extraTimeBodySchema>;

/** Query params for paginated entry listing (GET /me/entries, GET /station/entries). */
export const listEntriesQuerySchema = z.object({
  status: z.string().optional(),
  from: z.string().datetime({ message: 'from must be an ISO 8601 date' }).optional(),
  to: z.string().datetime({ message: 'to must be an ISO 8601 date' }).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;

export type CreateReservationBody = z.infer<typeof createReservationBodySchema>;
export type JoinQueueBody = z.infer<typeof joinQueueBodySchema>;
export type UpgradeToReservationBody = z.infer<typeof upgradeToReservationBodySchema>;
export type StationPatchEntryBody = z.infer<typeof stationPatchEntryBodySchema>;
export type StationPatchPositionBody = z.infer<typeof stationPatchPositionBodySchema>;
export type EntryIdParam = z.infer<typeof entryIdParamSchema>;
export type RescheduleBody = z.infer<typeof rescheduleBodySchema>;
export type SignalDelayBody = z.infer<typeof signalDelayBodySchema>;
export type RefuseDelayBody = z.infer<typeof refuseDelayBodySchema>;
