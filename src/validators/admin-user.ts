import { z } from 'zod';
import { mapZodErrors } from './auth';
import { phoneSchema } from './shared';

export { mapZodErrors };

/** Path param validator for admin user/station routes. */
export const adminIdParamSchema = z.object({
  id: z.string().uuid('Invalid id (must be a valid UUID)'),
});

const USER_STATUS_FILTER_VALUES = ['active', 'suspended', 'blocked', 'pending_verification'] as const;

/** GET /admin/users query params. */
export const listUsersQuerySchema = z.object({
  page:     z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
  status:   z.enum(USER_STATUS_FILTER_VALUES).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// ─── User update ──────────────────────────────────────────────────────────────

const USER_STATUS_VALUES = ['active', 'suspended', 'blocked', 'pending_verification'] as const;

/**
 * PUT /admin/users/:id body.
 * Whitelisted fields only - role, email, password_hash, and Stripe fields
 * are excluded from admin direct edits.
 */
export const updateUserSchema = z
  .object({
    first_name: z.string().trim().min(1, 'First name is required').max(100).optional(),
    last_name: z.string().trim().min(1, 'Last name is required').max(100).optional(),
    phone: phoneSchema.optional(),
    status: z.enum(USER_STATUS_VALUES, {
      errorMap: () => ({
        message: `status must be one of: ${USER_STATUS_VALUES.join(', ')}`,
      }),
    }).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ─── Station update ───────────────────────────────────────────────────────────

const STATION_STATUS_VALUES = ['active', 'suspended', 'disabled'] as const;
const SERVICE_SCOPE_VALUES = ['exterior', 'interior', 'both'] as const;

/**
 * PUT /admin/stations/:id body.
 * Whitelisted fields only - stripe_account_id, approved_by, approved_at,
 * average_score, and total_ratings are excluded from admin direct edits
 * (those are managed by dedicated endpoints or computed fields).
 */
export const updateStationAdminSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    legal_name: z.string().trim().min(2).max(200).optional(),
    address: z.string().trim().min(5).optional(),
    city: z.string().trim().min(2).max(100).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    description: z.string().max(1000).optional(),
    service_scope: z.enum(SERVICE_SCOPE_VALUES, {
      errorMap: () => ({
        message: `service_scope must be one of: ${SERVICE_SCOPE_VALUES.join(', ')}`,
      }),
    }).optional(),
    status: z.enum(STATION_STATUS_VALUES, {
      errorMap: () => ({
        message: `status must be one of: ${STATION_STATUS_VALUES.join(', ')}`,
      }),
    }).optional(),
    is_open: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type UpdateStationAdminInput = z.infer<typeof updateStationAdminSchema>;
export type AdminIdParam = z.infer<typeof adminIdParamSchema>;
