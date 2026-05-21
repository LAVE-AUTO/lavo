/**
 * Validators for the legal content API (GET/PATCH /api/v1/admin/legal/:key).
 *
 * Supported keys: cgu, politique_confidentialite, mentions_legales.
 * Content is stored as raw HTML/text and sanitized server-side before persistence.
 *
 * Note: empty string is rejected at the schema level (min(1)) because a legal
 * document must have content. To clear a document, use a meaningful placeholder
 * or delete the row directly from the database.
 */
import { z } from 'zod';

// %%%%% Constants %%%%%
// Allowed legal content keys

/**
 * The complete set of legal content keys managed through this API.
 *   - cgu:                       Client terms of service             (/cgu)
 *   - cgu_stations:              Station/merchant terms of service   (/cgu-stations)
 *   - politique_confidentialite: Privacy policy                      (/politique-de-confidentialite)
 *   - politique_annulation:      Cancellation policy                 (/politique-annulation)
 *   - mentions_legales:          Legal notices                       (/mentions-legales)
 *   - contact:                   Contact page content                (/nous-contacter)
 *   - landing_faq:               FAQ section on the landing          (/#faq)
 *   - landing_how_it_works:      "How it works" section on landing   (/#how-it-works)
 *
 * All keys are stored in the generic `settings` table (type='legal', entity_id=null)
 * so adding more keys requires no migration.
 */
export const LEGAL_CONTENT_KEYS = [
  'cgu',
  'cgu_stations',
  'politique_confidentialite',
  'politique_annulation',
  'mentions_legales',
  'contact',
  'landing_faq',
  'landing_how_it_works',
] as const;

export type LegalContentKey = (typeof LEGAL_CONTENT_KEYS)[number];


// %%%%% Schemas %%%%%
// URL parameter and body validation schemas

/**
 * Validates the :key URL parameter against the set of supported legal keys.
 *
 * Used in route handlers: `legalKeyParamSchema.safeParse({ key: params.key })`.
 */
export const legalKeyParamSchema = z.object({
  key: z.enum(LEGAL_CONTENT_KEYS, {
    errorMap: () => ({
      message: `Legal content key must be one of: ${LEGAL_CONTENT_KEYS.join(', ')}`,
    }),
  }),
});

/**
 * Validates the PATCH request body for updating legal content.
 *
 * Constraints:
 *   - content: required string, 1–100 000 characters
 *   - Unknown fields are rejected (strict mode)
 */
export const updateLegalContentBodySchema = z
  .object({
    content: z
      .string()
      .min(1, 'content is required and must not be empty')
      .max(100_000, 'content must not exceed 100 000 characters'),
  })
  .strict();

export type UpdateLegalContentBody = z.infer<typeof updateLegalContentBodySchema>;
