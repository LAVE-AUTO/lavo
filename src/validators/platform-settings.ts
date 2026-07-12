/**
 * Validator for the platform settings API (GET/PATCH /api/v1/admin/settings).
 *
 * All whitelisted keys are declared in ALLOWED_PLATFORM_SETTING_KEYS.
 * Per-key semantic rules are enforced in the superRefine callback so each
 * failure is reported under the correct key path.
 */
import { z } from 'zod';
import { mapZodErrors } from '@/validators/shared';

export { mapZodErrors };


// %%%%% Constants %%%%%
// Whitelisted keys and type definitions

/**
 * All admin-configurable platform setting keys.
 * Includes business rules (cancellation, booking), content limits (ratings, support),
 * and notification email addresses.
 */

/**
 * Stripe card authorizations expire after 7 days.
 * This is the technical upper bound for max_advance_booking_days; bookings beyond
 * this window would have their PaymentIntent expire before capture.
 * If the payment processor changes, update both this constant and the booking logic.
 */
export const MAX_STRIPE_AUTH_DAYS = 7;

export const ALLOWED_PLATFORM_SETTING_KEYS = [
  'cancellation_free_window_minutes',
  'cancellation_penalty_percent',
  'cancellation_penalty_platform_rate',
  'cancellation_penalty_station_rate',
  'platform_service_fee',
  'max_advance_booking_days',
  'rating_window_days',
  'default_late_tolerance_minutes',
  'max_tip_amount_xaf',
  'reminder_first_window_hours',
  'reminder_second_window_minutes',
  'admin_notification_email',
  'weekly_report_email',
  'max_rating_comment_length',
  'max_support_message_length',
  'dispute_window_days',
  'kyc_reminder_first_threshold_days',
  'kyc_reminder_second_threshold_days',
  'admin_log_retention_days',
] as const;

export type PlatformSettingKey = (typeof ALLOWED_PLATFORM_SETTING_KEYS)[number];


// %%%%% END - Constants %%%%%


// %%%%% Helper functions %%%%%
// Parsing and validation utilities

/**
 * Base integer parser: trims whitespace, parses as base-10 integer, and rejects
 * values whose string representation does not round-trip exactly (catches leading
 * zeros, spaces, and non-integer input). Returns NaN on any failure.
 */
function parseStrictInteger(raw: string): number {
  const trimmed = raw.trim();
  const val = parseInt(trimmed, 10);
  if (isNaN(val) || String(val) !== trimmed) return NaN;
  return val;
}

/**
 * Parses a string as a non-negative integer. Returns NaN on failure.
 */
function parseNonNegativeInteger(raw: string): number {
  const val = parseStrictInteger(raw);
  if (isNaN(val) || val < 0) return NaN;
  return val;
}

/**
 * Parses a string as a positive integer with an optional maximum. Returns NaN on failure.
 */
function parsePositiveInteger(raw: string, max?: number): number {
  const val = parseStrictInteger(raw);
  if (isNaN(val) || val < 1) return NaN;
  if (max !== undefined && val > max) return NaN;
  return val;
}

/**
 * Parses a string as an integer within [min, max]. Returns NaN on failure.
 */
function parseBoundedInteger(raw: string, min: number, max: number): number {
  const val = parseStrictInteger(raw);
  if (isNaN(val) || val < min || val > max) return NaN;
  return val;
}

/**
 * Parses a decimal string with optional maximum decimal places check.
 * Returns NaN on failure.
 */
function parseDecimalString(raw: string, maxDecimalPlaces: number): number {
  const trimmed = raw.trim();
  const val = parseFloat(trimmed);
  if (!Number.isFinite(val)) return NaN;
  const decimalPart = trimmed.split('.')[1] ?? '';
  if (decimalPart.length > maxDecimalPlaces) return NaN;
  return val;
}

/**
 * Adds a custom Zod issue to the refinement context for a specific field path.
 */
function addIssue(ctx: z.RefinementCtx, path: string, message: string): void {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
}


// %%%%% END - Helper functions %%%%%


// %%%%% Schema definition %%%%%
// Bulk platform settings update schema with comprehensive per-key validation

/**
 * Bulk platform-settings update schema.
 *
 * Accepts a record of known keys → string values.
 *   - Minimum 1 key required; maximum one per allowed key
 *   - Unknown keys are rejected
 *   - Per-key semantic rules enforce correct types and value ranges via superRefine
 *
 * Each field failure is reported under its correct key path for precise error reporting.
 */
export const updatePlatformSettingsSchema = z
  .record(
    z.enum(ALLOWED_PLATFORM_SETTING_KEYS, {
      errorMap: () => ({
        message: `Setting key must be one of: ${ALLOWED_PLATFORM_SETTING_KEYS.join(', ')}`,
      }),
    }),
    z.string().max(500, 'Setting value must not exceed 500 characters')
  )
  .refine(
    (obj) => Object.keys(obj).length >= 1,
    'At least one setting key is required'
  )
  .refine(
    (obj) => Object.keys(obj).length <= ALLOWED_PLATFORM_SETTING_KEYS.length,
    `Cannot update more than ${ALLOWED_PLATFORM_SETTING_KEYS.length} settings at once`
  )
  .superRefine((obj, ctx) => {

    // --- Group A: Cancellation policy ---

    if ('cancellation_free_window_minutes' in obj) {
      const val = parseNonNegativeInteger(obj.cancellation_free_window_minutes!);
      if (isNaN(val)) {
        addIssue(ctx, 'cancellation_free_window_minutes', 'cancellation_free_window_minutes must be a non-negative integer');
      }
    }

    if ('cancellation_penalty_percent' in obj) {
      const val = parseDecimalString(obj.cancellation_penalty_percent!, 2);
      if (isNaN(val) || val < 0 || val > 100) {
        addIssue(ctx, 'cancellation_penalty_percent', 'cancellation_penalty_percent must be a decimal between 0 and 100 with at most 2 decimal places');
      }
    }

    if ('cancellation_penalty_platform_rate' in obj) {
      const val = parseDecimalString(obj.cancellation_penalty_platform_rate!, 2);
      if (isNaN(val) || val < 0 || val > 1) {
        addIssue(ctx, 'cancellation_penalty_platform_rate', 'cancellation_penalty_platform_rate must be a decimal between 0 and 1 with at most 2 decimal places');
      }
    }

    if ('cancellation_penalty_station_rate' in obj) {
      const val = parseDecimalString(obj.cancellation_penalty_station_rate!, 2);
      if (isNaN(val) || val < 0 || val > 1) {
        addIssue(ctx, 'cancellation_penalty_station_rate', 'cancellation_penalty_station_rate must be a decimal between 0 and 1 with at most 2 decimal places');
      }
    }

    // Cross-key validation: platform_rate + station_rate must sum to 1.00
    if ('cancellation_penalty_platform_rate' in obj && 'cancellation_penalty_station_rate' in obj) {
      const platformVal = parseDecimalString(obj.cancellation_penalty_platform_rate!, 2);
      const stationVal = parseDecimalString(obj.cancellation_penalty_station_rate!, 2);
      if (Number.isFinite(platformVal) && Number.isFinite(stationVal)) {
        const sum = Math.round((platformVal + stationVal) * 100) / 100;
        if (sum !== 1.0) {
          addIssue(ctx, 'cancellation_penalty_platform_rate', 'cancellation_penalty_platform_rate and cancellation_penalty_station_rate must sum to 1.00');
        }
      }
    }


    // --- Group B: Reservations & booking ---

    if ('platform_service_fee' in obj) {
      const val = parseDecimalString(obj.platform_service_fee!, 2);
      if (isNaN(val) || val < 0) {
        addIssue(ctx, 'platform_service_fee', 'platform_service_fee must be a non-negative decimal with at most 2 decimal places');
      }
    }

    if ('max_advance_booking_days' in obj) {
      const val = parseBoundedInteger(obj.max_advance_booking_days!, 1, MAX_STRIPE_AUTH_DAYS);
      if (isNaN(val)) {
        addIssue(ctx, 'max_advance_booking_days', `max_advance_booking_days must be an integer between 1 and ${MAX_STRIPE_AUTH_DAYS}`);
      }
    }

    if ('rating_window_days' in obj) {
      const val = parsePositiveInteger(obj.rating_window_days!);
      if (isNaN(val)) {
        addIssue(ctx, 'rating_window_days', 'rating_window_days must be a positive integer (minimum 1)');
      }
    }

    if ('dispute_window_days' in obj) {
      const val = parsePositiveInteger(obj.dispute_window_days!);
      if (isNaN(val)) {
        addIssue(ctx, 'dispute_window_days', 'dispute_window_days must be a positive integer (minimum 1)');
      }
    }

    if ('default_late_tolerance_minutes' in obj) {
      const val = parseNonNegativeInteger(obj.default_late_tolerance_minutes!);
      if (isNaN(val)) {
        addIssue(ctx, 'default_late_tolerance_minutes', 'default_late_tolerance_minutes must be a non-negative integer');
      }
    }


    // --- Group C: Tips ---

    if ('max_tip_amount_xaf' in obj) {
      const val = parseNonNegativeInteger(obj.max_tip_amount_xaf!);
      if (isNaN(val)) {
        addIssue(ctx, 'max_tip_amount_xaf', 'max_tip_amount_xaf must be a non-negative integer');
      }
    }


    // --- Group D: Reminders ---

    if ('reminder_first_window_hours' in obj) {
      const val = parsePositiveInteger(obj.reminder_first_window_hours!);
      if (isNaN(val)) {
        addIssue(ctx, 'reminder_first_window_hours', 'reminder_first_window_hours must be a positive integer (minimum 1)');
      }
    }

    if ('reminder_second_window_minutes' in obj) {
      const val = parsePositiveInteger(obj.reminder_second_window_minutes!);
      if (isNaN(val) || val < 5) {
        addIssue(ctx, 'reminder_second_window_minutes', 'reminder_second_window_minutes must be a positive integer (minimum 5)');
      }
    }


    // --- Group E: Notification emails ---

    if ('admin_notification_email' in obj) {
      const val = obj.admin_notification_email!;
      if (val !== '' && !z.string().email().safeParse(val).success) {
        addIssue(ctx, 'admin_notification_email', 'admin_notification_email must be a valid email address or empty string to unset');
      }
    }

    if ('weekly_report_email' in obj) {
      const val = obj.weekly_report_email!;
      if (val !== '' && !z.string().email().safeParse(val).success) {
        addIssue(ctx, 'weekly_report_email', 'weekly_report_email must be a valid email address or empty string to unset');
      }
    }


    // --- Group F: Content limits ---

    if ('max_rating_comment_length' in obj) {
      const val = parseBoundedInteger(obj.max_rating_comment_length!, 50, 5000);
      if (isNaN(val)) {
        addIssue(ctx, 'max_rating_comment_length', 'max_rating_comment_length must be an integer between 50 and 5000');
      }
    }

    if ('max_support_message_length' in obj) {
      const val = parseBoundedInteger(obj.max_support_message_length!, 100, 10000);
      if (isNaN(val)) {
        addIssue(ctx, 'max_support_message_length', 'max_support_message_length must be an integer between 100 and 10000');
      }
    }


    // --- Group G: KYC document expiry reminders ---

    if ('kyc_reminder_first_threshold_days' in obj) {
      const val = parsePositiveInteger(obj.kyc_reminder_first_threshold_days!);
      if (isNaN(val)) {
        addIssue(ctx, 'kyc_reminder_first_threshold_days', 'kyc_reminder_first_threshold_days must be a positive integer (minimum 1, default 30)');
      }
    }

    if ('kyc_reminder_second_threshold_days' in obj) {
      const val = parsePositiveInteger(obj.kyc_reminder_second_threshold_days!);
      if (isNaN(val)) {
        addIssue(ctx, 'kyc_reminder_second_threshold_days', 'kyc_reminder_second_threshold_days must be a positive integer (minimum 1, default 7)');
      }
    }

    if ('admin_log_retention_days' in obj) {
      const val = parseBoundedInteger(obj.admin_log_retention_days!, 7, 3650);
      if (isNaN(val)) {
        addIssue(ctx, 'admin_log_retention_days', 'admin_log_retention_days must be an integer between 7 and 3650 days');
      }
    }

  });

export type UpdatePlatformSettingsInput = z.infer<typeof updatePlatformSettingsSchema>;


// %%%%% END - Schema definition %%%%%
