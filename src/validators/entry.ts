/**
 * Zod schemas for reservation and queue (entry) API request bodies and params.
 */
import { z } from 'zod';
import { mapZodErrors } from './auth';

export { mapZodErrors };

const uuidSchema = z.string().uuid('Must be a valid UUID');

/** Path param: entry id (for PATCH me/entries/:entryId/cancel, POST upgrade-to-reservation, PATCH station/entries/:entryId). */
export const entryIdParamSchema = z.object({
  entryId: z.string().uuid('Invalid entry id'),
});

/** Path param: reservation id (for POST /reservations/:id/cancel). */
export const reservationIdParamSchema = z.object({
  id: z.string().uuid('Invalid reservation id'),
});

/** POST /reservations/:id/cancel — optional cancellation reason. */
export const cancelReservationBodySchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict();

/** POST /stations/:id/reservations — create reservation. */
export const createReservationBodySchema = z
  .object({
    time_slot_id: uuidSchema,
    vehicle_format_id: uuidSchema,
  })
  .strict();

/** POST /stations/:id/queue/join — join queue. */
export const joinQueueBodySchema = z
  .object({
    vehicle_format_id: uuidSchema,
  })
  .strict();

/** PATCH /me/entries/:entryId/cancel — optional cancellation reason (used for confirmed reservations). */
export const cancelEntryBodySchema = z
  .object({
    reason: z.string().max(500).optional(),
  })
  .strict()
  .optional();

/** POST /me/entries/:entryId/upgrade-to-reservation — upgrade queue to reservation. */
export const upgradeToReservationBodySchema = z
  .object({
    time_slot_id: uuidSchema,
  })
  .strict();

/** PATCH /station/entries/:entryId — set status (in_progress, completed, cancelled). */
export const stationPatchEntryBodySchema = z
  .object({
    status: z.enum(['in_progress', 'completed', 'cancelled'], {
      errorMap: () => ({ message: 'status must be in_progress, completed, or cancelled' }),
    }),
  })
  .strict();

/** PATCH /station/entries/:entryId/position — reorder queue. */
export const stationPatchPositionBodySchema = z
  .object({
    queue_position: z.number().int().min(1, 'queue_position must be at least 1'),
  })
  .strict();

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
