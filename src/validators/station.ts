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
        document_type: z.string().min(1).max(50),
        file_url: z.string().url('Invalid file URL'),
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

export type RegisterStationDto = z.infer<typeof registerStationSchema>;
export type StationInfoDto = z.infer<typeof stationInfoSchema>;
export type StationDocumentsDto = z.infer<typeof stationDocumentsSchema>;
export type StationOnboardingSubmitDto = z.infer<typeof stationOnboardingSubmitSchema>;
export type RejectStationDto = z.infer<typeof rejectStationSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
