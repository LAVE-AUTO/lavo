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

export const createTicketSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(255),
  message: z.string().min(10, "Description must be at least 10 characters"),
  priority: supportPrioritySchema.optional().default("normal"),
  category: supportCategorySchema.optional().default("autre"),
});

export const addSupportMessageSchema = z.object({
  content: z.string().min(1, "Message content cannot be empty"),
});

export const updateTicketStatusSchema = z.object({
  status: supportStatusSchema,
});

/**
 * Settings are key→value pairs where both key and value must be strings.
 * Values are capped at 500 characters to prevent abuse.
 */
export const updateSupportSettingsSchema = z.record(
  z.string(),
  z.string().max(500, "Setting value must not exceed 500 characters")
);
