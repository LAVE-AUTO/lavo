import { z } from 'zod';
import { mapZodErrors } from './auth';
import { phoneSchema } from './shared';

export { mapZodErrors };

// ─── Base objects (reused in the submit schema) ──────────────────────────────

const _step1Base = z.object({
  email: z.string().email('Invalid email address'),
  phone: phoneSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  confirm_password: z.string().min(1, 'Password confirmation is required'),
});

const _step2Base = z.object({
  station_name: z.string().min(2).max(200),
  legal_name: z.string().min(2).max(200).optional(),
  registration_number: z.string().max(100).optional(),
  address: z.string().min(5),
  city: z.string().min(2).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  wash_post_count: z.number().int().min(1),
  wash_type: z.enum(['hand_wash', 'automatic', 'self_service']),
  description: z.string().max(1000).optional(),
});

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

// ─── Per-step validation schemas (no DB — used by validate endpoints) ────────

// Step 1: account credentials
export const registerStationSchema = _step1Base.refine(
  (data) => data.password === data.confirm_password,
  { message: 'Passwords do not match', path: ['confirm_password'] }
);

// Step 2: station details
export const stationInfoSchema = _step2Base;

// Step 3: documents + legal confirmation
export const stationDocumentsSchema = _step3Base;

// ─── Final submit schema (all steps merged — triggers DB operations) ─────────

export const stationOnboardingSubmitSchema = _step1Base
  .merge(_step2Base)
  .merge(_step3Base)
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });

// ─── Admin ────────────────────────────────────────────────────────────────────

// Admin: reject a station
export const rejectStationSchema = z.object({
  rejection_reason: z.string().min(10, 'Rejection reason must be at least 10 characters'),
});

// Auth: change password
export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirm_new_password: z.string().min(1, 'Password confirmation is required'),
  })
  .refine((data) => data.new_password === data.confirm_new_password, {
    message: 'Passwords do not match',
    path: ['confirm_new_password'],
  });

// ─── Public API (Card 1) ─────────────────────────────────────────────────────

/** Path param id for GET /stations/:id and POST /stations/:id/join. */
export const stationIdParamSchema = z.object({
  id: z.string().uuid('Invalid station id (must be a valid UUID)'),
});

/** Query params for GET /api/v1/stations (list active stations). */
export const listStationsQuerySchema = z.object({
  q: z
    .string()
    .optional()
    .transform((s) => (typeof s === 'string' ? s.trim() : undefined) || undefined)
    .refine((s) => s === undefined || s.length <= 200, {
      message: 'Search must be at most 200 characters',
    }),
  city: z
    .string()
    .optional()
    .transform((s) => (typeof s === 'string' ? s.trim() : undefined) || undefined)
    .refine((s) => s === undefined || s.length <= 100, {
      message: 'City must be at most 100 characters',
    }),
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
    .optional()
    .refine(
      (arr) =>
        arr === undefined ||
        (Array.isArray(arr) &&
          arr.length <= 50 &&
          arr.every((id) => z.string().uuid().safeParse(id).success)),
      { message: 'wash_type_ids must be comma-separated UUIDs (max 50)' }
    ),
  service_scope: z
    .string()
    .optional()
    .transform((s) => (s === '' || s === undefined ? undefined : s))
    .refine(
      (s) => s === undefined || ['exterior', 'interior', 'both'].includes(s),
      { message: 'service_scope must be exterior, interior, or both' }
    ),
  format_id: z
    .string()
    .optional()
    .transform((s) => (s === '' || s === undefined ? undefined : s))
    .refine(
      (s) => s === undefined || z.string().uuid().safeParse(s).success,
      { message: 'format_id must be a valid UUID' }
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

// ─── Station config API (Unit 2) ─────────────────────────────────────────────

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

/** Valid calendar date YYYY-MM-DD (rejects e.g. 2024-02-30). */
function isValidCalendarDate(s: string): boolean {
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

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

export type CreateSlotBody = z.infer<typeof createSlotBodySchema>;
export type CreateSlotsBulkBody = z.infer<typeof createSlotsBulkBodySchema>;
export type GenerateSlotsBody = z.infer<typeof generateSlotsBodySchema>;

// ─── Vehicle format API ──────────────────────────────────────────────────────

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

export type CreateFormatBody = z.infer<typeof createFormatBodySchema>;
export type UpdateFormatBody = z.infer<typeof updateFormatBodySchema>;
export type PatchFormatBody = z.infer<typeof patchFormatBodySchema>;
export type FormatIdParam = z.infer<typeof formatIdParamSchema>;

// ─── Public API (Card 1) ─────────────────────────────────────────────────────

export type StationIdParam = z.infer<typeof stationIdParamSchema>;
export type ListStationsQuery = z.infer<typeof listStationsQuerySchema>;

export type RegisterStationDto = z.infer<typeof registerStationSchema>;
export type StationInfoDto = z.infer<typeof stationInfoSchema>;
export type StationDocumentsDto = z.infer<typeof stationDocumentsSchema>;
export type StationOnboardingSubmitDto = z.infer<typeof stationOnboardingSubmitSchema>;
export type RejectStationDto = z.infer<typeof rejectStationSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
