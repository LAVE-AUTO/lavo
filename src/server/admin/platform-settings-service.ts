/**
 * Platform-wide settings service.
 * Settings are stored in the `settings` table with type='admin' and entity_id=null (global).
 *
 * Cancellation policy keys (seeded in DB, editable via admin panel):
 *   - cancellation_free_window_minutes: 60   (free cancellation if >= 60 min before service)
 *   - cancellation_penalty_percent: 20        (% of amount_paid kept as penalty if late)
 */
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { settings } from '@/lib/db/schema';

export type CancellationPolicy = {
  freeWindowMinutes: number;
  penaltyRate: number;
};

const DEFAULTS: CancellationPolicy = {
  freeWindowMinutes: 60,
  penaltyRate: 0.2, // 20% — matches seeded cancellation_penalty_percent value
};

/**
 * Reads a global admin setting by key. Returns null if not found.
 */
export async function getPlatformSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.type, 'admin'), eq(settings.key, key), isNull(settings.entity_id)),
  });
  return row?.value ?? null;
}

/**
 * Returns the active cancellation policy from platform settings.
 * Falls back to defaults if settings are not configured.
 */
export async function getCancellationPolicy(): Promise<CancellationPolicy> {
  const [windowRaw, percentRaw] = await Promise.all([
    getPlatformSetting('cancellation_free_window_minutes'),
    getPlatformSetting('cancellation_penalty_percent'),
  ]);

  const freeWindowMinutes = windowRaw ? parseInt(windowRaw, 10) : DEFAULTS.freeWindowMinutes;
  // DB stores as percentage (e.g. "20"), convert to rate (0.20)
  const penaltyRate = percentRaw ? parseFloat(percentRaw) / 100 : DEFAULTS.penaltyRate;

  return {
    freeWindowMinutes: Number.isFinite(freeWindowMinutes) ? freeWindowMinutes : DEFAULTS.freeWindowMinutes,
    penaltyRate: Number.isFinite(penaltyRate) ? penaltyRate : DEFAULTS.penaltyRate,
  };
}
