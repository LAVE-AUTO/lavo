import { z } from "zod";

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
  subject: z.string().min(5, "Subject must be at least 5 characters").max(255),
  message: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(5000, "Description must not exceed 5000 characters"),
  priority: supportPrioritySchema.optional().default("normal"),
  category: supportCategorySchema.optional().default("autre"),
});

export const addSupportMessageSchema = z.object({
  content: z
    .string()
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
  );

/** Optional status query param filter - must match a valid status if provided. */
export const supportStatusFilterSchema = supportStatusSchema.optional();
