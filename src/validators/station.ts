import { z } from 'zod';
import { mapZodErrors } from './auth';
import { phoneSchema, passwordSchema } from './shared';
import { isValidCalendarDate } from '@/helpers/date-helper';

export { mapZodErrors };


// %%%%% Shared refinements %%%%%
// Reusable predicate and constant lifted to avoid inline duplication

/** Rejects any date string that does not represent a moment strictly after now. */
const isFutureDate = (s: string) => new Date(s) > new Date();

/** Union of recognised group keys for GET /api/v1/stations?groups=. */
type StationGroup = 'available_now' | 'most_appreciated' | 'most_visited';

/** All recognised sort tokens for GET /api/v1/stations. */
const VALID_SORT_TOKENS = [
  'slots_asc', 'slots_desc',
  'name_asc', 'name_desc',
  'rating_asc', 'rating_desc',
  'total_ratings_asc', 'total_ratings_desc',
  'completed_count_asc', 'completed_count_desc',
  'distance_asc', 'distance_desc',
] as const;

const VALID_SORT_MESSAGE =
  'Invalid sort value(s). Use comma-separated: ' + VALID_SORT_TOKENS.join(', ');


// %%%%% END - Shared refinements %%%%%


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
// No DB operations - used by validate endpoints only

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
// All steps merged - triggers DB operations

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
          // Accept either ISO 8601 datetime or bare YYYY-MM-DD date strings and
          // ensure the string resolves to a real calendar date (rejects 2024-02-30T00:00:00Z, etc.).
          .refine(
            (s) => {
              const d = new Date(s);
              if (Number.isNaN(d.getTime())) return false;
              // For bare dates, reuse the calendar-sanity check.
              if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isValidCalendarDate(s);
              // For datetime strings, round-trip through the date and verify the date part is stable.
              const datePart = d.toISOString().slice(0, 10);
              return isValidCalendarDate(datePart);
            },
            { message: 'expiry_date must be a valid ISO 8601 datetime or YYYY-MM-DD date' }
          )
          .refine(isFutureDate, { message: 'expiry_date must be a future date' }),
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

// oooo Internal helpers for listStationsQuerySchema oooo

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
function optionalEmptyToUndefined(refineFn: (s: string) => boolean, message: string) {
  return z
    .string()
    .optional()
    .transform((s): string | undefined => (s === '' || s === undefined ? undefined : s))
    .refine((s) => s === undefined || refineFn(s), { message });
}

// oooo END - Internal helpers oooo

/** Path param id for GET /stations/:id and POST /stations/:id/join. */
export const stationIdParamSchema = z.object({
  id: z.string().uuid('Invalid station id (must be a valid UUID)'),
});

/** Path param docId for PATCH /admin/stations/:id/documents/:docId. */
export const adminDocumentIdParamSchema = z.object({
  docId: z.string().uuid('Invalid document id (must be a valid UUID)'),
});

/**
 * Request body for PATCH /admin/stations/:id/documents/:docId.
 * expiry_date must be a YYYY-MM-DD string representing a real future calendar date,
 * or null to clear the field.
 */
export const updateDocumentExpirySchema = z.object({
  expiry_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'expiry_date must be YYYY-MM-DD')
    .refine(isValidCalendarDate, { message: 'expiry_date must be a valid calendar date' })
    .refine(isFutureDate, { message: 'expiry_date must be a future date' })
    .nullable(),
});

export type AdminDocumentIdParam = z.infer<typeof adminDocumentIdParamSchema>;
export type UpdateDocumentExpiryBody = z.infer<typeof updateDocumentExpirySchema>;

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
        // Sort tokens are comma-separated in the query string.
        const tokens = s.split(',').map((t) => t.trim()).filter(Boolean);
        return tokens.every((t) => (VALID_SORT_TOKENS as readonly string[]).includes(t));
      },
      { message: VALID_SORT_MESSAGE }
    ),
  groups: z
    .string()
    .optional()
    .transform((s): StationGroup[] | undefined => {
      if (!s) return undefined;
      const allowed = new Set<string>(['available_now', 'most_appreciated', 'most_visited']);
      const tokens = s.split(',').map((t) => t.trim()).filter((t) => allowed.has(t));
      return tokens.length ? ([...new Set(tokens)] as StationGroup[]) : undefined;
    })
    .refine(
      (arr) => arr === undefined || arr.length > 0,
      { message: 'groups must be comma-separated: available_now, most_appreciated, most_visited' }
    ),
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
    .refine(isValidCalendarDate, { message: 'date must be a valid calendar date' })
    .optional(),
  near_lat: z
    .string()
    .optional()
    .transform((s) => (s === '' || s === undefined ? undefined : Number(s)))
    .refine((n) => n === undefined || (Number.isFinite(n) && n >= -90 && n <= 90), {
      message: 'near_lat must be a number between -90 and 90',
    }),
  near_lng: z
    .string()
    .optional()
    .transform((s) => (s === '' || s === undefined ? undefined : Number(s)))
    .refine((n) => n === undefined || (Number.isFinite(n) && n >= -180 && n <= 180), {
      message: 'near_lng must be a number between -180 and 180',
    }),
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


// %%%%% Station profile update %%%%%

/**
 * PATCH /api/v1/station/me - partial update of station profile fields.
 * wash_post_count is intentionally excluded: it is managed via station config
 * to avoid desync with station_configs.wash_post_count.
 */
export const updateStationProfileBodySchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(200, 'Name must be at most 200 characters').optional(),
    description: z.string().trim().max(1000, 'Description must be at most 1000 characters').nullable().optional(),
    address: z.string().trim().min(5, 'Address must be at least 5 characters').optional(),
    city: z.string().trim().min(2, 'City must be at least 2 characters').max(100, 'City must be at most 100 characters').optional(),
    postal_code: z.string().trim().max(20, 'Postal code must be at most 20 characters').nullable().optional(),
    latitude: z.number().min(-90, 'Latitude must be between -90 and 90').max(90, 'Latitude must be between -90 and 90').nullable().optional(),
    longitude: z.number().min(-180, 'Longitude must be between -180 and 180').max(180, 'Longitude must be between -180 and 180').nullable().optional(),
    service_scope: z.enum(['exterior', 'interior', 'both']).nullable().optional(),
    wash_types: z.array(z.string().uuid('Each wash type must be a valid UUID')).min(1, 'At least one wash type is required').optional(),
  })
  .strict()
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'At least one field must be provided' }
  );

export type UpdateStationProfileBody = z.infer<typeof updateStationProfileBodySchema>;

/** PATCH /api/v1/station/photos - full replacement of station photos (url + position pairs). */
export const stationPhotosBodySchema = z
  .object({
    photos: z
      .array(
        z.object({
          url: z
            .string()
            .url('Each photo must be a valid URL')
            .refine(
              (val) => {
                const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
                // Fail closed: if the env var is absent the server is misconfigured -
                // reject every URL rather than silently accepting arbitrary origins.
                if (!cloudName) return false;
                try {
                  const { hostname } = new URL(val);
                  if (
                    hostname === 'res.cloudinary.com' ||
                    hostname === `${cloudName}.cloudinary.com`
                  ) {
                    return true;
                  }
                  // Also allow URLs served from the app host (local/fallback storage).
                  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
                  if (appUrl) {
                    return hostname === new URL(appUrl).hostname;
                  }
                  return false;
                } catch {
                  return false;
                }
              },
              { message: 'URL must be a valid Cloudinary or application-hosted URL' }
            ),
          position: z.number().int().min(0),
        })
      )
      .max(20, 'At most 20 photos allowed')
      .refine(
        (photos) => {
          const positions = photos.map((p) => p.position);
          return new Set(positions).size === positions.length;
        },
        { message: 'Duplicate position values are not allowed' }
      ),
  })
  .strict();

export type StationPhotosBody = z.infer<typeof stationPhotosBodySchema>;


// %%%%% END - Station profile update %%%%%


// %%%%% Services and Extras %%%%%

const serviceVehicleEntrySchema = z.object({
  // For hand_wash entries this is the real vehicle format UUID.
  // For automatic/self_service entries it is omitted (null).
  vehicle_format_id: z.string().uuid('Invalid vehicle format ID').nullable().optional(),
  // Human-readable label stored with the entry (package name or format label).
  vehicle_label: z.string().min(1).max(255),
  price: z.union([
    z.number().positive('Price must be greater than 0'),
    z.string().regex(/^\d+(\.\d{1,2})?$/).refine((v) => parseFloat(v) > 0, 'Price must be greater than 0'),
  ]),
  duration_min: z.number().int().min(1, 'Duration must be at least 1 minute').optional().default(45),
  staff_required: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

export const createServiceBodySchema = z.object({
  name: z.string().min(1).max(255, 'Service name must not exceed 255 characters'),
  category: z.enum(['hand_wash', 'automatic', 'self_service']),
  service_type: z.enum(['exterior', 'interior', 'complete']),
  description: z.string().max(2000).optional(),
  is_active: z.boolean().optional().default(true),
  is_popular: z.boolean().optional().default(false),
  vehicle_entries: z.array(serviceVehicleEntrySchema).min(1, 'At least one vehicle entry is required'),
  compatible_extra_ids: z.array(z.string().uuid()).optional().default([]),
});

export const patchServiceBodySchema = createServiceBodySchema.partial();

export const createExtraBodySchema = z.object({
  name: z.string().min(1).max(255, 'Extra name must not exceed 255 characters'),
  applicable_on: z.enum(['exterior', 'interior', 'both']),
  price: z.union([z.number().min(0), z.string().regex(/^\d+(\.\d{1,2})?$/)]),
  duration: z.number().int().min(0).optional().default(10),
  is_active: z.boolean().optional().default(true),
});

export const patchExtraBodySchema = createExtraBodySchema.partial();

export const serviceIdParamSchema = z.object({
  id: z.string().uuid('Invalid service ID'),
});

export const extraIdParamSchema = z.object({
  id: z.string().uuid('Invalid extra ID'),
});

// %%%%% END - Services and Extras %%%%%


// %%%%% Exported types %%%%%

export type CreateSlotBody = z.infer<typeof createSlotBodySchema>;
export type CreateSlotsBulkBody = z.infer<typeof createSlotsBulkBodySchema>;
export type GenerateSlotsBody = z.infer<typeof generateSlotsBodySchema>;

export type CreateFormatBody = z.infer<typeof createFormatBodySchema>;
export type UpdateFormatBody = z.infer<typeof updateFormatBodySchema>;
export type PatchFormatBody = z.infer<typeof patchFormatBodySchema>;
export type FormatIdParam = z.infer<typeof formatIdParamSchema>;

export type CreateServiceBody = z.infer<typeof createServiceBodySchema>;
export type PatchServiceBody = z.infer<typeof patchServiceBodySchema>;
export type CreateExtraBody = z.infer<typeof createExtraBodySchema>;
export type PatchExtraBody = z.infer<typeof patchExtraBodySchema>;
export type ServiceIdParam = z.infer<typeof serviceIdParamSchema>;
export type ExtraIdParam = z.infer<typeof extraIdParamSchema>;

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
