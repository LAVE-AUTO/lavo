import { z } from 'zod';
import { mapZodErrors } from './auth';
import { phoneSchema, passwordSchema } from './shared';

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


// ─── User create ──────────────────────────────────────────────────────────────

const CREATE_USER_ROLE_VALUES = ['client', 'admin'] as const;

/**
 * POST /admin/users body.
 * Creates a new client or admin user. Password is auto-generated server-side.
 */
export const createUserSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name:  z.string().trim().min(1, 'Last name is required').max(100),
  email:      z.string().trim().email('Invalid email').max(254),
  phone:      phoneSchema.optional(),
  role:       z.enum(CREATE_USER_ROLE_VALUES, {
    errorMap: () => ({ message: `role must be one of: ${CREATE_USER_ROLE_VALUES.join(', ')}` }),
  }),
}).strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;


// ─── Station create ───────────────────────────────────────────────────────────

const STATION_SERVICE_SCOPE_VALUES = ['exterior', 'interior', 'both'] as const;

/**
 * POST /admin/stations body.
 * Creates the station owner account (role=station) and the station record in one transaction.
 */
export const createStationAdminSchema = z.object({
  owner: z.object({
    first_name: z.string().trim().min(1, 'First name is required').max(100),
    last_name:  z.string().trim().min(1, 'Last name is required').max(100),
    email:      z.string().trim().email('Invalid email').max(254),
    phone:      phoneSchema.optional(),
  }),
  station: z.object({
    name:          z.string().trim().min(2).max(200),
    legal_name:    z.string().trim().min(2).max(200).optional(),
    address:       z.string().trim().min(5),
    city:          z.string().trim().min(2).max(100),
    service_scope: z.enum(STATION_SERVICE_SCOPE_VALUES).optional(),
    description:   z.string().max(1000).optional(),
  }),
}).strict();

export type CreateStationAdminInput = z.infer<typeof createStationAdminSchema>;


// ─── Delete ───────────────────────────────────────────────────────────────────

/** DELETE /admin/users/:id and DELETE /admin/stations/:id query param. */
export const deleteEntitySchema = z.object({
  permanent: z.enum(['true', 'false']).transform((v) => v === 'true').optional().default('false'),
});

export type DeleteEntityQuery = z.infer<typeof deleteEntitySchema>;


// ─── Admin profile ────────────────────────────────────────────────────────────

/**
 * PATCH /admin/me body.
 * At least one field is required.
 */
export const adminProfileUpdateSchema = z
  .object({
    first_name: z.string().trim().min(1).max(100).optional(),
    last_name:  z.string().trim().min(1).max(100).optional(),
    phone:      phoneSchema.optional().nullable(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field is required',
  });

export type AdminProfileUpdateInput = z.infer<typeof adminProfileUpdateSchema>;

/** POST /admin/me/otp body. */
export const adminRequestOtpSchema = z.object({
  purpose: z.enum(['email_change', 'password_change']),
}).strict();

export type AdminRequestOtpInput = z.infer<typeof adminRequestOtpSchema>;

/** POST /admin/me/email body. */
export const adminEmailChangeSchema = z.object({
  new_email: z.string().trim().email('Invalid email').max(254),
  otp_code:  z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be 6 digits'),
}).strict();

export type AdminEmailChangeInput = z.infer<typeof adminEmailChangeSchema>;

/** POST /admin/me/password body. */
export const adminPasswordChangeSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password:     passwordSchema,
  otp_code:         z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be 6 digits'),
}).strict();

export type AdminPasswordChangeInput = z.infer<typeof adminPasswordChangeSchema>;
