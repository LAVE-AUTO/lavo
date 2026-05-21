/**
 * Legal content service.
 *
 * Reads and writes legal/landing documents (CGU, privacy policy, legal notices,
 * cancellation, contact, landing sections) from the settings table using
 * type='legal' and entity_id=null (global scope).
 *
 * Content is sanitized with DOMPurify before persistence to strip XSS vectors.
 * Only the keys declared in LEGAL_CONTENT_KEYS are accepted.
 *
 * When no row exists yet for a key, getLegalContent falls back to the bundled
 * HTML default (see legal-content-defaults.ts). The public pages read through
 * this same helper so admin saves take effect immediately.
 *
 * requires: npm install isomorphic-dompurify
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import DOMPurify from 'isomorphic-dompurify';

import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { getDefaultLegalContent } from './legal-content-defaults';
import type { LegalContentKey } from '@/validators/legal-content';


// %%%%% Read %%%%%
// Retrieve legal content by key from the settings table

/**
 * Returns the stored legal content for the given key, or the bundled HTML
 * default when no row exists yet. Both the admin editor and the public
 * pages call through this helper so they always see the same content.
 *
 * Pass `withDefault=false` to inspect raw storage (returns null when empty).
 */
export async function getLegalContent(
  key: string,
  options: { withDefault?: boolean; locale?: 'fr' | 'en' } = {},
): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: and(
      eq(settings.type, 'legal'),
      isNull(settings.entity_id),
      eq(settings.key, key)
    ),
  });
  if (row?.value) return row.value;

  const withDefault = options.withDefault !== false;
  if (!withDefault) return null;
  return getDefaultLegalContent(key as LegalContentKey, options.locale ?? 'fr');
}


// %%%%% Write %%%%%
// Upsert legal content with server-side sanitization

/**
 * Sanitizes and upserts legal content for the given key.
 *
 * Sanitization strips any XSS vectors from the HTML content using DOMPurify
 * before the value reaches the database. The sanitized value - not the raw
 * input - is what gets stored and later served.
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
): Promise<string> {
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

  return sanitized;
}
