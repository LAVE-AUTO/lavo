/**
 * Zod schemas for support ticket API endpoints.
 *
 * Schemas:
 *   - createTicketSchema: POST /api/v1/support (create ticket)
 *   - addSupportMessageSchema: POST /api/v1/support/:id/messages (add message)
 *   - updateTicketStatusSchema: PATCH /api/v1/support/:id (update status)
 *   - updateSupportSettingsSchema: PATCH /api/v1/admin/support/settings (admin settings)
 *
 * Features:
 *   - Dynamic max message length (configurable via platform settings)
 *   - Enumerated priorities, categories, and statuses (French labels)
 *   - Per-key semantic validation for admin settings
 */
import { z } from "zod";
import { mapZodErrors } from "./auth";

export { mapZodErrors };


// %%%%% Enums %%%%%
// Support ticket field enumerations (French labels)

export const supportPrioritySchema = z.enum(["bas", "normal", "urgent"]);
export const supportCategorySchema = z.enum([
  "technique",
  "facturation",
  "bug",
  "autre",
]);

/**
 * Valid ticket statuses in the system.
 * Lifecycle: ouvert → en_cours → resolu → ferme
 */
export const supportStatusSchema = z.enum(["ouvert", "en_cours", "resolu", "ferme"]);


// %%%%% Param validators %%%%%
// Route parameter validation

/**
 * Validator for ticket ID param (route [id] segments).
 * Ensures valid UUID format.
 */
export const supportTicketIdSchema = z.string().uuid("Invalid ticket ID format");


// %%%%% Create ticket schema %%%%%
// POST /api/v1/support

/**
 * Schema for creating a new support ticket.
 * Validates subject (5–255 chars), initial message (10–5000 chars),
 * and optional priority/category with defaults.
 */
export const createTicketSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(5, "Subject must be at least 5 characters")
    .max(255),
  message: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must not exceed 5000 characters"),
  priority: supportPrioritySchema.optional().default("normal"),
  category: supportCategorySchema.optional().default("autre"),
});


// %%%%% Add message schema %%%%%
// POST /api/v1/support/:id/messages (with configurable max length)

/**
 * Factory that builds the add-message schema with a dynamic max length.
 * Call this with the platform-configured maximum (read from DB → env → default)
 * to honour admin-configured content limits.
 *
 * @param maxLength - Maximum characters allowed in message content
 * @returns Zod schema for POST /api/v1/support/:id/messages request body
 */
export function createSupportMessageSchema(maxLength: number) {
  return z.object({
    content: z
      .string()
      .trim()
      .min(1, 'Message content cannot be empty')
      .max(maxLength, `Message must not exceed ${maxLength} characters`),
  });
}

/** Static schema with hardcoded default (5000 chars) for backward compat and tests. */
export const addSupportMessageSchema = createSupportMessageSchema(5000);


// %%%%% Update ticket status schema %%%%%
// PATCH /api/v1/support/:id

export const updateTicketStatusSchema = z.object({
  status: supportStatusSchema,
});


// %%%%% Admin settings schema %%%%%
// PATCH /api/v1/admin/support/settings (admin only)

const ALLOWED_SETTINGS_KEYS = [
  "support_email",
  "max_open_tickets_per_user",
  "auto_close_days",
  "welcome_message",
] as const;

/**
 * Schema for bulk support settings update (admin only).
 *
 * Constraints:
 *   - Keys: restricted to ALLOWED_SETTINGS_KEYS (prevent injection)
 *   - Values: max 500 chars each (prevent abuse)
 *   - Count: max 10 keys per request (prevent DoS)
 *
 * Per-key validation via superRefine:
 *   - support_email: valid email format
 *   - max_open_tickets_per_user: non-negative integer
 *   - auto_close_days: positive integer
 *   - welcome_message: no semantic validation (free text)
 */
export const updateSupportSettingsSchema = z
  .record(
    z.enum(ALLOWED_SETTINGS_KEYS, {
      errorMap: () => ({
        message: `Setting key must be one of: ${ALLOWED_SETTINGS_KEYS.join(", ")}`,
      }),
    }),
    z.string().max(500, "Setting value must not exceed 500 characters")
  )
  .refine(
    (obj) => Object.keys(obj).length <= 10,
    "Cannot update more than 10 settings at once"
  )
  .superRefine((obj, ctx) => {
    if ("support_email" in obj && obj.support_email !== undefined) {
      const emailResult = z.string().email().safeParse(obj.support_email);
      if (!emailResult.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["support_email"],
          message: "support_email must be a valid email address",
        });
      }
    }
    if ("max_open_tickets_per_user" in obj && obj.max_open_tickets_per_user !== undefined) {
      const val = parseInt(obj.max_open_tickets_per_user, 10);
      if (isNaN(val) || val < 0 || String(val) !== obj.max_open_tickets_per_user.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["max_open_tickets_per_user"],
          message: "max_open_tickets_per_user must be a non-negative integer",
        });
      }
    }
    if ("auto_close_days" in obj && obj.auto_close_days !== undefined) {
      const val = parseInt(obj.auto_close_days, 10);
      if (isNaN(val) || val < 1 || String(val) !== obj.auto_close_days.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["auto_close_days"],
          message: "auto_close_days must be a positive integer",
        });
      }
    }
    if ("welcome_message" in obj && obj.welcome_message !== undefined) {
      // Defense-in-depth: reject HTML/script tags to prevent stored XSS even
      // though React auto-escapes output. This blocks <script>, <img onerror>, etc.
      if (/<[^>]*>/i.test(obj.welcome_message)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["welcome_message"],
          message: "welcome_message must not contain HTML tags",
        });
      }
    }
  });

/** Optional status query param filter - must match a valid status if provided. */
export const supportStatusFilterSchema = supportStatusSchema.optional();

/**
 * Body schema for PATCH /api/v1/admin/support/[id]/assign.
 * `assigned_to` must be a valid UUID when provided, or null to unassign.
 */
export const assignTicketSchema = z.object({
  assigned_to: z.string().uuid('assigned_to must be a valid UUID').nullable(),
});
