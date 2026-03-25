import { z } from "zod";
import { mapZodErrors } from "./auth";

export { mapZodErrors };

export const supportPrioritySchema = z.enum(["bas", "normal", "urgent"]);
export const supportCategorySchema = z.enum([
  "technique",
  "facturation",
  "bug",
  "autre",
]);

/** Valid ticket statuses in this system. */
export const supportStatusSchema = z.enum(["ouvert", "en_cours", "resolu", "ferme"]);

/** Reusable UUID param validator for route [id] segments. */
export const supportTicketIdSchema = z.string().uuid("Invalid ticket ID format");

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

export const addSupportMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Message content cannot be empty")
    .max(5000, "Message must not exceed 5000 characters"),
});

export const updateTicketStatusSchema = z.object({
  status: supportStatusSchema,
});

/** Allowed settings keys to prevent arbitrary key injection. */
const ALLOWED_SETTINGS_KEYS = [
  "support_email",
  "max_open_tickets_per_user",
  "auto_close_days",
  "welcome_message",
] as const;

/**
 * Settings are key→value pairs restricted to known keys.
 * Values are capped at 500 characters to prevent abuse.
 * Maximum 10 keys per request to prevent DoS.
 * Per-key semantic validation prevents invalid data from reaching the DB.
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
