/**
 * Zod schemas for ratings API endpoints.
 *
 * Schemas:
 *   - createRatingCommentSchema: POST /api/v1/ratings (client rating submission)
 *   - stationRatingsQuerySchema: GET /api/v1/stations/:id/ratings (public listing)
 *   - adminRatingsQuerySchema: GET /api/v1/admin/ratings (admin moderation interface)
 *   - updateRatingVisibilitySchema: PATCH /api/v1/admin/ratings/:id (toggle visibility)
 *
 * Features:
 *   - Dynamic max comment length (configurable via platform settings)
 *   - Cross-field validation (score_min <= score_max, from <= to)
 *   - Pagination validation (page >= 1, limit in ranges)
 *   - Date validation (YYYY-MM-DD format and valid calendar dates)
 */
import { z } from 'zod';
import { mapZodErrors } from './auth';
import { isValidCalendarDate } from '@/helpers/date-helper';

export { mapZodErrors };


// %%%%% Common validators %%%%%
// Reusable field schemas

const uuidSchema = z.string().uuid('Must be a valid UUID');



// %%%%% Client rating submission %%%%%
// POST /api/v1/ratings body

/**
 * Factory that builds the POST /api/v1/ratings body schema with configurable max comment length.
 *
 * Called with the platform-configured maximum (read from DB → env → default) to honour
 * admin-set limits. Validates:
 *   - reservation_id: valid UUID
 *   - score: integer 1–5
 *   - comment: optional string up to maxCommentLength
 *
 * @param maxCommentLength - Max characters allowed in comment field (e.g., 500, 1000)
 * @returns Zod schema for POST /api/v1/ratings request body
 */
export function createRatingCommentSchema(maxCommentLength: number) {
  return z
    .object({
      reservation_id: uuidSchema,
      score: z
        .number({ invalid_type_error: 'score must be a number' })
        .int('score must be an integer')
        .min(1, 'score must be at least 1')
        .max(5, 'score must be at most 5'),
      comment: z
        .string()
        .max(maxCommentLength, `comment must not exceed ${maxCommentLength} characters`)
        .optional(),
    })
    .strict();
}

/** Static schema with hardcoded default (500 chars) for backward compat and tests. */
export const postRatingBodySchema = createRatingCommentSchema(500);


// %%%%% Public station ratings %%%%%
// GET /api/v1/stations/:id/ratings query and params

export const ratingStationIdParamSchema = z.object({
  id: uuidSchema,
});

export const stationRatingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});


// %%%%% Admin ratings management %%%%%
// GET /api/v1/admin/ratings (with filters), PATCH /api/v1/admin/ratings/:id

/**
 * Query schema for admin ratings listing with filtering and pagination.
 *
 * Filters:
 *   - station_id: optional UUID (filter by station)
 *   - is_visible: optional boolean (filter by visibility)
 *   - score_min / score_max: optional 1–5 range (cross-validated: min <= max)
 *   - from / to: optional YYYY-MM-DD dates (cross-validated: from <= to)
 *
 * Sorting & pagination:
 *   - sort_by: 'created_at' or 'score' (default: 'created_at')
 *   - sort_order: 'asc' or 'desc' (default: 'desc')
 *   - page: integer >= 1 (default: 1)
 *   - limit: 1–100 (default: 20)
 */
export const adminRatingsQuerySchema = z
  .object({
    station_id:   uuidSchema.optional(),
    station_name: z.string().max(100).optional(),
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
