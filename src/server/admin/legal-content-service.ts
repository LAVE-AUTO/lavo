/**
 * Legal content service.
 *
 * Reads and writes legal/landing documents (CGU, privacy policy, legal notices,
 * cancellation, contact, landing sections) from the settings table using
 * type='legal' and entity_id=null (global scope).
 *
 * Content is sanitized with sanitize-html before persistence to strip XSS vectors.
 * sanitize-html is a pure Node.js sanitizer with no jsdom dependency, which avoids
 * the ESM/CJS conflict caused by isomorphic-dompurify → jsdom → html-encoding-sniffer
 * → @exodus/bytes (ESM-only) on Vercel serverless functions.
 * Only the keys declared in LEGAL_CONTENT_KEYS are accepted.
 *
 * When no row exists yet for a key, getLegalContent falls back to the bundled
 * HTML default (see legal-content-defaults.ts). The public pages read through
 * this same helper so admin saves take effect immediately.
 *
 * requires: npm install sanitize-html @types/sanitize-html
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import sanitizeHtml from 'sanitize-html';

import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';
import { getDefaultLegalContent } from './legal-content-defaults';
import type { LegalContentKey } from '@/validators/legal-content';

// Allowlist matching Tiptap's output: headings, text marks, lists, links, hr, blockquote, code.
// style is restricted to text-align only; href is restricted to safe schemes.
const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'p', 'br', 'hr',
    'strong', 'em', 'u', 's', 'code', 'pre',
    'ul', 'ol', 'li',
    'blockquote',
    'a',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'class'],
    '*': ['class', 'style'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(?:left|right|center|justify)$/],
    },
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
};


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
  const withDefault = options.withDefault !== false;

  /* The public legal/landing pages read through this helper at render time. A DB
   * outage (e.g. provider compute quota exceeded) must not crash a public page:
   * fall back to the bundled default content instead of throwing. */
  let row: { value: string | null } | undefined;
  try {
    row = await db.query.settings.findFirst({
      where: and(
        eq(settings.type, 'legal'),
        isNull(settings.entity_id),
        eq(settings.key, key)
      ),
    });
  } catch (e) {
    // Handled, expected degradation (e.g. DB unreachable / over quota): warn, do
    // not error - the page renders fine with bundled defaults.
    console.warn('[getLegalContent] settings read failed, using bundled default', {
      key,
      error: e instanceof Error ? e.message : String(e),
    });
    return withDefault ? getDefaultLegalContent(key as LegalContentKey, options.locale ?? 'fr') : null;
  }
  if (row?.value) return row.value;

  if (!withDefault) return null;
  return getDefaultLegalContent(key as LegalContentKey, options.locale ?? 'fr');
}


// %%%%% Write %%%%%
// Upsert legal content with server-side sanitization

/**
 * Sanitizes and upserts legal content for the given key.
 *
 * Sanitization strips any XSS vectors from the HTML content using sanitize-html
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
  const sanitized = sanitizeHtml(content, SANITIZE_OPTIONS);
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
