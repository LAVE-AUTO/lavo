/**
 * Zod schemas for ratings API endpoints (client submit, public listing, admin management).
 */
import { z } from 'zod';
import { mapZodErrors } from './auth';
import { isValidCalendarDate } from '@/helpers/date-helper';

export { mapZodErrors };


// %%%%% Schema definitions %%%%%
// Common schemas and validators

const uuidSchema = z.string().uuid('Must be a valid UUID');


// %%%%% Client rating submission %%%%%
// POST /api/v1/ratings body schema

export const postRatingBodySchema = z
  .object({
    reservation_id: uuidSchema,
    score: z
      .number({ invalid_type_error: 'score must be a number' })
      .int('score must be an integer')
      .min(1, 'score must be at least 1')
      .max(5, 'score must be at most 5'),
    comment: z.string().max(500, 'comment must not exceed 500 characters').optional(),
  })
  .strict();


// %%%%% Public station ratings %%%%%
// GET /api/v1/stations/:id/ratings

export const ratingStationIdParamSchema = z.object({
  id: uuidSchema,
});

export const stationRatingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});


// %%%%% Admin ratings management %%%%%
// GET /api/v1/admin/ratings, PATCH /api/v1/admin/ratings/:id

export const adminRatingsQuerySchema = z
  .object({
    station_id: uuidSchema.optional(),
    is_visible: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    score_min: z.coerce.number().int().min(1).max(5).optional(),
    score_max: z.coerce.number().int().min(1).max(5).optional(),
    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'Invalid date' })
      .optional(),
    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'Invalid date' })
      .optional(),
    sort_by: z.enum(['created_at', 'score']).optional().default('created_at'),
    sort_order: z.enum(['asc', 'desc']).optional().default('desc'),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })
  .refine(
    (data) => {
      if (data.score_min !== undefined && data.score_max !== undefined) {
        return data.score_min <= data.score_max;
      }
      return true;
    },
    { message: 'score_min must be <= score_max' }
  )
  .refine(
    (data) => {
      if (data.from && data.to) {
        return data.from <= data.to;
      }
      return true;
    },
    { message: 'from must be <= to' }
  );

export const adminRatingIdParamSchema = z.object({
  id: uuidSchema,
});

export const adminToggleRatingBodySchema = z
  .object({
    is_visible: z.boolean({ invalid_type_error: 'is_visible must be a boolean' }),
  })
  .strict();


// %%%%% Type exports %%%%%
// Inferred types from schemas

export type PostRatingBody = z.infer<typeof postRatingBodySchema>;
export type StationRatingsQuery = z.infer<typeof stationRatingsQuerySchema>;
export type AdminRatingsQuery = z.infer<typeof adminRatingsQuerySchema>;
export type AdminToggleRatingBody = z.infer<typeof adminToggleRatingBodySchema>;
