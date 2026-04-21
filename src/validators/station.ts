import { z } from 'zod';
import { mapZodErrors } from './auth';
import { phoneSchema, passwordSchema } from './shared';
import { isValidCalendarDate } from '@/helpers/date-helper';

export { mapZodErrors };


// %%%%% Onboarding base objects %%%%%
// Reused in per-step and full-submit schemas

// ooooo Step 1: Account credentials ooooo

const _step1Base = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(320, 'Email must not exceed 320 characters')
    .refine((s) => !s.includes('..'), { message: 'Email cannot contain consecutive dots' }),
  phone: phoneSchema,
  password: passwordSchema,
  confirm_password: z.string().min(1, 'Password confirmation is required'),
});

/** Allowed values for type de prestation (exterior, interior, or both). */
const serviceScopeEnum = z.enum(['exterior', 'interior', 'both']);


// ooooo Step 2: Station details ooooo

const _step2Base = z.object({
  station_name: z.string().min(2).max(200),
  legal_name: z.string().min(2).max(200).optional(),
  registration_number: z.string().max(100).optional(),
  address: z.string().min(5),
  city: z.string().min(2).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  wash_post_count: z.number().int().min(1),
  wash_type_ids: z
    .array(z.string().uuid('Each wash type id must be a valid UUID'))
    .min(1, 'At least one wash type is required')
    .max(50, 'At most 50 wash types allowed'),
  description: z.string().max(1000).optional(),
  /** Type de prestation: optional at onboarding; persisted as nullable on stations. */
  service_scope: serviceScopeEnum.optional(),
});


// ooooo Step 3: Documents + legal ooooo

const _step3Base = z.object({
  documents: z
    .array(
      z.object({
        document_type: z.string().trim().min(1, 'Document type is required').max(50),
        file_url: z.string().trim().url('Invalid file URL'),
        storage: z.enum(['cloudinary', 'local']).optional(),
      })
    )
    .min(1, 'At least one document is required'),
  terms_accepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
});


// %%%%% END - Onboarding base objects %%%%%


// %%%%% Per-step validation schemas %%%%%
// No DB operations — used by validate endpoints only

// Step 1: account credentials
export const registerStationSchema = _step1Base.refine(
  (data) => data.password === data.confirm_password,
  { message: 'Passwords do not match', path: ['confirm_password'] }
);

// Step 2: station details
export const stationInfoSchema = _step2Base;

// Step 3: documents + legal confirmation
export const stationDocumentsSchema = _step3Base;


// %%%%% END - Per-step validation schemas %%%%%


// %%%%% Full submit schema %%%%%
// All steps merged — triggers DB operations

export const stationOnboardingSubmitSchema = _step1Base
  .merge(_step2Base)
  .merge(_step3Base)
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });


// %%%%% END - Full submit schema %%%%%


// %%%%% Admin schemas %%%%%

/** Path param id for admin station routes (GET/approve/reject). */
export const adminStationIdParamSchema = z.object({
  id: z.string().uuid('Invalid station id (must be a valid UUID)'),
});

/**
 * Optional body for POST /api/v1/admin/stations/:id/approve.
 * Allows the admin to set document expiry dates at approval time.
 * Accepts ISO 8601 datetime strings or YYYY-MM-DD date strings.
 */
export const approveStationBodySchema = z.object({
  document_expiry_dates: z
    .array(
      z.object({
        document_id: z.string().uuid('document_id must be a valid UUID'),
        expiry_date: z
          .string()
          .datetime({ message: 'expiry_date must be a valid ISO 8601 datetime or YYYY-MM-DD date' })
          .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be a valid ISO 8601 datetime or YYYY-MM-DD date'))
          .refine(
            (s) => new Date(s) > new Date(),
            { message: 'expiry_date must be a future date' }
          ),
      })
    )
    // A station cannot have more documents than this cap; an unbounded array would let
    // an admin POST cause O(N) ownership queries inside the approval transaction.
    .max(50, 'Cannot set expiry dates for more than 50 documents at once')
    .optional(),
});

export type ApproveStationBody = z.infer<typeof approveStationBodySchema>;

/** Admin: reject a station with a mandatory reason. */
export const rejectStationSchema = z.object({
  rejection_reason: z
    .string()
    .min(10, 'Rejection reason must be at least 10 characters')
    .max(2000, 'Rejection reason must not exceed 2000 characters'),
});

/** Query params for GET /admin/stations (paginated pending list). */
export const listPendingStationsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListPendingStationsQuery = z.infer<typeof listPendingStationsQuerySchema>;

/** Auth: change password for station account. */
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required').max(128, 'Password must not exceed 128 characters'),
    new_password: passwordSchema,
    confirm_new_password: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.new_password === data.confirm_new_password, {
    message: 'Passwords do not match',
    path: ['confirm_new_password'],
  });


// %%%%% END - Admin schemas %%%%%


// %%%%% Public API schemas (Card 1) %%%%%

// ---- Internal helpers for listStationsQuerySchema ----

/**
 * Optional string field: trims whitespace, converts empty strings to undefined,
 * and enforces a maximum length. Used for `q` and `city` query params.
 */
function optionalTrimmedString(maxLen: number, message: string) {
  return z
    .string()
    .optional()
    .transform((s) => (typeof s === 'string' ? s.trim() : undefined) || undefined)
    .refine((s) => s === undefined || s.length <= maxLen, { message });
}

/**
 * Optional string field: converts empty strings to undefined, then validates
 * the non-undefined value with the provided refine function.
 */
function optionalEmptyToUndefined<T extends string>(
  refineFn: (s: string) => boolean,
  message: string
) {
  return z
    .string()
    .optional()
    .transform((s): string | undefined => (s === '' || s === undefined ? undefined : s))
    .refine((s): s is T | undefined => s === undefined || refineFn(s), { message });
}

// ---- End internal helpers ----

/** Path param id for GET /stations/:id and POST /stations/:id/join. */
export const stationIdParamSchema = z.object({
  id: z.string().uuid('Invalid station id (must be a valid UUID)'),
});

/** Query params for GET /api/v1/stations (list active stations). */
export const listStationsQuerySchema = z.object({
  q: optionalTrimmedString(200, 'Search must be at most 200 characters'),
  city: optionalTrimmedString(100, 'City must be at most 100 characters'),
  sort: z
    .string()
    .optional()
    .transform((s) => (typeof s === 'string' ? s.trim() : undefined) || undefined)
    .refine(
      (s) => {
        if (!s) return true;
        const tokens = s.split(',').map((t) => t.trim()).filter(Boolean);
        return tokens.every((t) =>
          ['slots_asc', 'slots_desc', 'name_asc', 'name_desc', 'rating_asc', 'rating_desc', 'total_ratings_asc', 'total_ratings_desc', 'completed_count_asc', 'completed_count_desc'].includes(t)
        );
      },
      { message: 'Invalid sort value(s). Use comma-separated: slots_asc, slots_desc, name_asc, name_desc, rating_asc, rating_desc, total_ratings_asc, total_ratings_desc, completed_count_asc, completed_count_desc' }
    ),
  groups: z
    .string()
    .optional()
    .refine(
      (s) => {
        if (!s || typeof s !== 'string') return true;
        const allowed = new Set(['available_now', 'most_appreciated', 'most_visited']);
        const tokens = s.split(',').map((t) => t.trim()).filter(Boolean);
        return tokens.every((t) => allowed.has(t));
      },
      { message: 'groups must be comma-separated: available_now, most_appreciated, most_visited' }
    )
    .transform((s) => {
      if (!s || typeof s !== 'string') return undefined;
      const allowed = new Set(['available_now', 'most_appreciated', 'most_visited']);
      const arr = s.split(',').map((t) => t.trim()).filter((t) => allowed.has(t));
      const unique = arr.length ? [...new Set(arr)] as ('available_now' | 'most_appreciated' | 'most_visited')[] : undefined;
      return unique;
    }),
  page: z
    .string()
    .optional()
    .transform((s) => (s ? parseInt(s, 10) : undefined))
    .refine(
      (n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 10_000),
      { message: 'page must be an integer between 1 and 10000' }
    ),
  per_page: z
    .string()
    .optional()
    .transform((s) => (s ? parseInt(s, 10) : undefined))
    .refine((n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 100), { message: 'per_page must be an integer between 1 and 100' }),
  limit_per_group: z
    .string()
    .optional()
    .transform((s) => (s ? parseInt(s, 10) : undefined))
    .refine(
      (n) => n === undefined || (Number.isInteger(n) && n >= 1 && n <= 100),
      { message: 'limit_per_group must be an integer between 1 and 100' }
    ),
  wash_type_ids: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return undefined;
      return s.split(',').map((t) => t.trim()).filter(Boolean);
    })
    .refine(
      (arr) =>
        arr === undefined ||
        (Array.isArray(arr) &&
          arr.length <= 50 &&
          arr.every((id) => z.string().uuid().safeParse(id).success)),
      { message: 'wash_type_ids must be comma-separated UUIDs (max 50)' }
    ),
  service_scope: optionalEmptyToUndefined(
    (s) => serviceScopeEnum.safeParse(s).success,
    'service_scope must be exterior, interior, or both'
  ),
  format_id: optionalEmptyToUndefined(
    (s) => z.string().uuid().safeParse(s).success,
    'format_id must be a valid UUID'
  ),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
    .optional()
    .refine(
      (s) => {
        if (!s) return true;
        const d = new Date(s + 'T00:00:00Z');
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
      },
      { message: 'date must be a valid calendar date' }
    ),
});


// %%%%% END - Public API schemas (Card 1) %%%%%


// %%%%% Station config API (Unit 2) %%%%%

/** Time string HH:mm or HH:mm:ss (optional timezone suffix). */
const timeStringSchema = z
  .string()
  .regex(/^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?(\+00|Z)?$/, 'Invalid time format (use HH:mm or HH:mm:ss)');

const stationPostItemSchema = z.object({
  position: z.number().int().min(1, 'Position must be at least 1'),
  is_active: z.boolean(),
});

export const stationConfigBodySchema = z
  .object({
    opening_time: timeStringSchema.optional(),
    closing_time: timeStringSchema.optional(),
    break_start: timeStringSchema.nullable().optional(),
    break_end: timeStringSchema.nullable().optional(),
    wash_duration_minutes: z.number().int().min(1).max(480).optional(),
    wash_post_count: z.number().int().min(1).max(100).optional(),
    late_tolerance_minutes: z.number().int().min(0).max(120).optional(),
    cancellation_delay_minutes: z.number().int().min(0).max(10080).optional(),
    max_concurrent_posts: z.number().int().min(1).max(100).optional(),
    margin_before_minutes: z.number().int().min(0).max(60).optional(),
    margin_after_minutes: z.number().int().min(0).max(60).optional(),
    reservation_surcharge: z.number().min(0).max(99999.99).nullable().optional(),
    posts: z.array(stationPostItemSchema).max(200, 'Too many posts').optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (!data.posts || data.posts.length === 0) return true;
      const positions = data.posts.map((p) => p.position);
      return new Set(positions).size === positions.length;
    },
    { message: 'Duplicate position in posts', path: ['posts'] }
  );

export type StationConfigBody = z.infer<typeof stationConfigBodySchema>;

/** Single slot: start_time and end_time as ISO datetime strings; capacity 1–10000. */
export const createSlotBodySchema = z
  .object({
    start_time: z.string().datetime({ message: 'start_time must be a valid ISO 8601 datetime' }),
    end_time: z.string().datetime({ message: 'end_time must be a valid ISO 8601 datetime' }),
    capacity: z.number().int().min(1, 'Capacity must be at least 1').max(10000, 'Capacity must be at most 10000'),
  })
  .refine((data) => new Date(data.start_time) < new Date(data.end_time), {
    message: 'start_time must be before end_time',
    path: ['end_time'],
  });

/** Bulk create slots. */
export const createSlotsBulkBodySchema = z.object({
  slots: z.array(createSlotBodySchema).min(1).max(500),
});

export const slotIdParamSchema = z.object({
  id: z.string().uuid('Invalid slot id'),
});

export const deleteSlotsBodySchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
  })
  .strict();

/** Generate slots: date or date range; optional interval_minutes. */
export const generateSlotsBodySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'date must be a valid calendar date' }),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'end_date must be YYYY-MM-DD')
      .refine(isValidCalendarDate, { message: 'end_date must be a valid calendar date' })
      .optional(),
    interval_minutes: z.number().int().min(5).max(120).optional(),
  })
  .refine(
    (data) => !data.end_date || data.end_date >= data.date,
    { message: 'end_date must be on or after date', path: ['end_date'] }
  );


// %%%%% END - Station config API (Unit 2) %%%%%


// %%%%% Vehicle format API %%%%%

/** Path param id for PUT/PATCH/DELETE /station/formats/:id. */
export const formatIdParamSchema = z.object({
  id: z.string().uuid('Invalid format id (must be a valid UUID)'),
});

/** POST /station/formats: label 1–100 chars, price > 0, is_active optional default true. */
export const createFormatBodySchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required').max(100, 'Label must be at most 100 characters'),
    price: z.number().positive('Price must be greater than 0'),
    is_active: z.boolean().optional().default(true),
  })
  .strict();

/** PUT /station/formats/:id: full update, all fields required. */
export const updateFormatBodySchema = z
  .object({
    label: z.string().trim().min(1, 'Label is required').max(100, 'Label must be at most 100 characters'),
    price: z.number().positive('Price must be greater than 0'),
    is_active: z.boolean(),
  })
  .strict();

/** PATCH /station/formats/:id: partial update, at least one field. */
export const patchFormatBodySchema = z
  .object({
    label: z.string().trim().min(1, 'Label must be at least 1 character').max(100, 'Label must be at most 100 characters').optional(),
    price: z.number().positive('Price must be greater than 0').optional(),
    is_active: z.boolean().optional(),
  })
  .strict()
  .refine((data) => data.label !== undefined || data.price !== undefined || data.is_active !== undefined, {
    message: 'At least one field (label, price, is_active) is required',
  });


// %%%%% END - Vehicle format API %%%%%


// %%%%% Exported types %%%%%

export type CreateSlotBody = z.infer<typeof createSlotBodySchema>;
export type CreateSlotsBulkBody = z.infer<typeof createSlotsBulkBodySchema>;
export type GenerateSlotsBody = z.infer<typeof generateSlotsBodySchema>;

export type CreateFormatBody = z.infer<typeof createFormatBodySchema>;
export type UpdateFormatBody = z.infer<typeof updateFormatBodySchema>;
export type PatchFormatBody = z.infer<typeof patchFormatBodySchema>;
export type FormatIdParam = z.infer<typeof formatIdParamSchema>;

export type StationIdParam = z.infer<typeof stationIdParamSchema>;
export type ListStationsQuery = z.infer<typeof listStationsQuerySchema>;

export type RegisterStationDto = z.infer<typeof registerStationSchema>;
export type StationInfoDto = z.infer<typeof stationInfoSchema>;
export type StationDocumentsDto = z.infer<typeof stationDocumentsSchema>;
export type StationOnboardingSubmitDto = z.infer<typeof stationOnboardingSubmitSchema>;
export type AdminStationIdParam = z.infer<typeof adminStationIdParamSchema>;
export type RejectStationDto = z.infer<typeof rejectStationSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;


// %%%%% END - Exported types %%%%%
