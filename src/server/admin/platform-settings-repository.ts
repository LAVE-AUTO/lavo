/**
 * Data access layer for platform-wide admin settings.
 *
 * Scope: type='admin' AND entity_id IS NULL (global scope, platform-wide).
 * Keys: only the 14 whitelisted keys from ALLOWED_PLATFORM_SETTING_KEYS are read or written.
 * Audit: updated_by tracks which admin last modified each setting.
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { settings, users } from '@/lib/db/schema';
import { ALLOWED_PLATFORM_SETTING_KEYS } from '@/validators/platform-settings';


// %%%%% Types %%%%%
// Data structures for platform settings

/**
 * A single platform setting row with audit metadata.
 * updated_by includes the admin's ID and full name if the setting has been modified.
 */
export type PlatformSettingRow = {
  key: string;
  value: string | null;
  updated_at: Date;
  updated_by: { id: string; first_name: string; last_name: string } | null;
};

/**
 * Internal type for upsert operations.
 * Contains the key, value, and the UUID of the admin performing the update.
 */
type UpsertEntry = {
  key: string;
  value: string;
  updatedBy: string;
};


// %%%%% Query functions %%%%%
// Read and write operations on platform settings

/**
 * Retrieves all whitelisted platform setting rows from the database.
 *
 * Performs a LEFT JOIN on users table to include the updater's name for audit display.
 * Rows that have never been set are absent from the result.
 *
 * @returns Array of PlatformSettingRow objects with value and audit metadata
 */
export async function getAllPlatformSettings(): Promise<PlatformSettingRow[]> {
  const rows = await db
    .select({
      key: settings.key,
      value: settings.value,
      updated_at: settings.updated_at,
      updated_by_id: settings.updated_by,
      first_name: users.first_name,
      last_name: users.last_name,
    })
    .from(settings)
    .leftJoin(users, eq(settings.updated_by, users.id))
    .where(
      and(
        eq(settings.type, 'admin'),
        isNull(settings.entity_id),
        inArray(settings.key, [...ALLOWED_PLATFORM_SETTING_KEYS])
      )
    );

  return rows.map((row) => ({
    key: row.key,
    value: row.value,
    updated_at: row.updated_at,
    updated_by:
      row.updated_by_id !== null && row.updated_by_id !== undefined
        ? {
            id: row.updated_by_id,
            first_name: row.first_name ?? '',
            last_name: row.last_name ?? '',
          }
        : null,
  }));
}


/**
 * Bulk upserts multiple platform settings in a single atomic statement.
 *
 * Uses INSERT ... ON CONFLICT (type, key) WHERE entity_id IS NULL DO UPDATE
 * to ensure idempotency and correct conflict resolution for global rows.
 *
 * @param entries - Array of key-value-updatedBy tuples to insert or update
 */
export async function upsertPlatformSettings(entries: UpsertEntry[]): Promise<void> {
  if (entries.length === 0) return;

  const now = new Date();
  const values = entries.map((e) => ({
    type: 'admin' as const,
    key: e.key,
    value: e.value,
    entity_id: null as string | null,
    updated_by: e.updatedBy,
    updated_at: now,
  }));

  await db
    .insert(settings)
    .values(values)
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
