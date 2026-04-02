/**
 * Legal content service.
 *
 * Reads and writes legal documents (CGU, privacy policy, legal notices) from the
 * settings table using type='legal' and entity_id=null (global scope).
 *
 * Content is sanitized with DOMPurify before persistence to strip XSS vectors.
 * Only the three keys declared in LEGAL_CONTENT_KEYS are accepted.
 *
 * requires: npm install isomorphic-dompurify
 */

// requires: npm install isomorphic-dompurify
import DOMPurify from 'isomorphic-dompurify';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';


// %%%%% Read %%%%%
// Retrieve legal content by key from the settings table

/**
 * Returns the stored legal content for the given key, or null if not yet set.
 *
 * Queries the settings table for type='legal', entity_id IS NULL, key=key.
 *
 * @param key - One of the supported legal content keys
 * @returns   - Raw stored content string, or null if not found
 */
export async function getLegalContent(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: and(
      eq(settings.type, 'legal'),
      isNull(settings.entity_id),
      eq(settings.key, key)
    ),
  });
  return row?.value ?? null;
}


// %%%%% Write %%%%%
// Upsert legal content with server-side sanitization

/**
 * Sanitizes and upserts legal content for the given key.
 *
 * Sanitization strips any XSS vectors from the HTML content using DOMPurify
 * before the value reaches the database. The sanitized value — not the raw
 * input — is what gets stored and later served.
 *
 * Uses INSERT ... ON CONFLICT DO UPDATE to ensure idempotency.
 * The unique index settings_type_key_global_idx (type, key) WHERE entity_id IS NULL
 * is the conflict target.
 *
 * @param key     - One of the supported legal content keys
 * @param content - Raw HTML/text content submitted by the admin
 * @param adminId - UUID of the admin performing the update (from JWT subject claim)
 */
export async function updateLegalContent(
  key: string,
  content: string,
  adminId: string
): Promise<void> {
  const sanitized = DOMPurify.sanitize(content);
  const now = new Date();

  await db
    .insert(settings)
    .values({
      type: 'legal',
      key,
      value: sanitized,
      entity_id: null,
      updated_by: adminId,
      updated_at: now,
    })
    .onConflictDoUpdate({
      target: [settings.type, settings.key],
      targetWhere: isNull(settings.entity_id),
      set: {
        value: sql`excluded.value`,
        updated_by: sql`excluded.updated_by`,
        updated_at: sql`NOW()`,
      },
    });
}
