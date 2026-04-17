/**
 * Platform-wide settings service.
 *
 * Settings are stored in the `settings` table with type='admin' and entity_id=null (global scope).
 * This service reads and writes business rule settings, with 3-tier fallback:
 *   1. Database value (settings table)
 *   2. Environment variable (PLATFORM_*)
 *   3. Hardcoded default
 *
 * Example: Cancellation policy keys (seeded in DB, editable via admin panel):
 *   - cancellation_free_window_minutes: 60   (free cancellation if >= 60 min before service)
 *   - cancellation_penalty_percent: 20       (% of amount_paid kept as penalty if late)
 *
 * Penalty distribution (how the retained penalty is split):
 *   - cancellation_penalty_platform_rate: 0.70  (fraction of penalty kept by platform)
 *   - cancellation_penalty_station_rate: 0.30   (fraction of penalty kept by station)
 *
 * Stripe mechanics for late cancellation:
 *   1. Refund the client (refundable amount) — from platform balance, reverse_transfer: false
 *   2. Reverse the station transfer for (penalty - station_share) to claw back platform's portion
 *   Result: platform nets its penalty share, station nets its penalty share
 */
import { eq, and, isNull, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { settings, commissionSettings } from '@/lib/db/schema';
import { DEFAULT_COMMISSION_RATE } from '@/helpers/server-constants';
import { isTruePlatformSetting } from '@/helpers/platform-setting-boolean';
import { ValidationError } from '@/lib/errors';
import {
  getAllPlatformSettings as repoGetAll,
  upsertPlatformSettings,
  type PlatformSettingRow,
} from './platform-settings-repository';
import type { UpdatePlatformSettingsInput } from '@/validators/platform-settings';

export type { PlatformSettingRow };


// %%%%% Types %%%%%
// Cancellation policy configuration

/**
 * Cancellation policy: free window, penalty rate, and how the penalty is split.
 * All rates and shares are fractions or percentages as documented.
 */
export type CancellationPolicy = {
  freeWindowMinutes: number;
  penaltyRate: number;
  platformPenaltyShare: number;
  stationPenaltyShare: number;
};

const DEFAULTS: CancellationPolicy = {
  freeWindowMinutes: 60,
  penaltyRate: 0.2,
  platformPenaltyShare: 0.7,
  stationPenaltyShare: 0.3,
};


// %%%%% Constants %%%%%
// Commission rate constraints

const COMMISSION_RATE_MIN = 0;
const COMMISSION_RATE_MAX = 1;


// %%%%% Commission rate %%%%%
// Active commission rate with fallback to defaults

/**
 * Returns the active platform commission rate as a decimal string (e.g. '0.1000').
 *
 * Logic:
 *   1. Query commissionSettings for the most recent row with effective_at <= now()
 *   2. Fall back to DEFAULT_COMMISSION_RATE if not found
 *   3. Clamp to [0, 1] to prevent injection of invalid values from DB
 *   4. Format as 4-decimal string
 *
 * @returns Commission rate as a string with 4 decimal places (e.g., '0.1000')
 */
export async function getActiveCommissionRate(): Promise<string> {
  const row = await db
    .select({ rate: commissionSettings.rate })
    .from(commissionSettings)
    .where(lte(commissionSettings.effective_at, new Date()))
    .orderBy(desc(commissionSettings.effective_at))
    .limit(1);

  const raw = row[0]?.rate ?? DEFAULT_COMMISSION_RATE;
  const parsed = parseFloat(String(raw));
  if (!Number.isFinite(parsed)) return DEFAULT_COMMISSION_RATE;
  const clamped = Math.min(COMMISSION_RATE_MAX, Math.max(COMMISSION_RATE_MIN, parsed));
  return clamped.toFixed(4);
}


// %%%%% Single setting reads %%%%%
// Get individual platform settings by key

/**
 * Reads a single global admin setting by key.
 * Returns null if not found or if entity_id is non-null.
 *
 * @param key - The setting key to read
 * @returns Setting value as a string, or null if not found
 */
export async function getPlatformSetting(key: string): Promise<string | null> {
  const row = await db.query.settings.findFirst({
    where: and(eq(settings.type, 'admin'), eq(settings.key, key), isNull(settings.entity_id)),
  });
  return row?.value ?? null;
}

/**
 * Checks whether admin FCM push on escrow release is enabled.
 *
 * Supports both canonical and legacy keys for backward compatibility:
 *   - Canonical: stripe_admin_notifications_enabled (preferred)
 *   - Legacy: enable_admin_push_on_escrow_released (fallback)
 *
 * @returns true if enabled, false otherwise
 */
export async function isAdminEscrowPushEnabled(): Promise<boolean> {
  const canonical = await getPlatformSetting('stripe_admin_notifications_enabled');
  if (canonical !== null) return isTruePlatformSetting(canonical);

  const legacy = await getPlatformSetting('enable_admin_push_on_escrow_released');
  return isTruePlatformSetting(legacy);
}


// %%%%% Cancellation policy %%%%%
// Composite business rule from multiple settings with fallbacks and normalization

/**
 * Returns the active cancellation policy from platform settings.
 *
 * Reads 4 settings with 3-tier fallback (DB → env var → hardcoded default):
 *   1. cancellation_free_window_minutes
 *   2. cancellation_penalty_percent (stored as %, e.g. "20" → 0.20)
 *   3. cancellation_penalty_platform_rate (stored as fraction, e.g. "0.70" → 0.70)
 *   4. cancellation_penalty_station_rate (stored as fraction, e.g. "0.30" → 0.30)
 *
 * Normalization:
 *   - Clamp penalty rate to [0, 1]
 *   - Clamp platform/station shares to [0, 1] each
 *   - If shares don't sum to 1, normalize proportionally
 *   - Validate finite values; fall back to hardcoded defaults on error
 *
 * @returns Cancellation policy with all fields clamped and normalized
 */
export async function getCancellationPolicy(): Promise<CancellationPolicy> {
  const [windowRaw, percentRaw, platformRaw, stationRaw] = await Promise.all([
    getPlatformSetting('cancellation_free_window_minutes').then(
      (v) => v ?? process.env.PLATFORM_CANCELLATION_FREE_WINDOW_MINUTES ?? null
    ),
    getPlatformSetting('cancellation_penalty_percent').then(
      (v) => v ?? process.env.PLATFORM_CANCELLATION_PENALTY_PERCENT ?? null
    ),
    getPlatformSetting('cancellation_penalty_platform_rate').then(
      (v) => v ?? process.env.PLATFORM_CANCELLATION_PENALTY_PLATFORM_RATE ?? null
    ),
    getPlatformSetting('cancellation_penalty_station_rate').then(
      (v) => v ?? process.env.PLATFORM_CANCELLATION_PENALTY_STATION_RATE ?? null
    ),
  ]);

  const freeWindowMinutes = windowRaw ? parseInt(windowRaw, 10) : DEFAULTS.freeWindowMinutes;
  // DB stores penalty as percentage (e.g. "20"), convert to rate (0.20)
  const rawRate = percentRaw ? parseFloat(percentRaw) / 100 : DEFAULTS.penaltyRate;

  // DB stores rates as fractions (e.g. "0.70" → 0.70, "0.30" → 0.30)
  const rawPlatformShare = platformRaw ? parseFloat(platformRaw) : DEFAULTS.platformPenaltyShare;
  const rawStationShare = stationRaw ? parseFloat(stationRaw) : DEFAULTS.stationPenaltyShare;

  // Clamp each share to [0, 1]
  const pShare = Number.isFinite(rawPlatformShare) ? Math.min(1, Math.max(0, rawPlatformShare)) : DEFAULTS.platformPenaltyShare;
  const sShare = Number.isFinite(rawStationShare) ? Math.min(1, Math.max(0, rawStationShare)) : DEFAULTS.stationPenaltyShare;

  // Normalize shares if they don't sum to 1
  const total = pShare + sShare;
  const platformPenaltyShare = total > 0 ? pShare / total : DEFAULTS.platformPenaltyShare;
  const stationPenaltyShare = total > 0 ? sShare / total : DEFAULTS.stationPenaltyShare;

  return {
    freeWindowMinutes: Number.isFinite(freeWindowMinutes) && freeWindowMinutes >= 0 ? freeWindowMinutes : DEFAULTS.freeWindowMinutes,
    penaltyRate: Number.isFinite(rawRate) ? Math.min(1, Math.max(0, rawRate)) : DEFAULTS.penaltyRate,
    platformPenaltyShare,
    stationPenaltyShare,
  };
}


// %%%%% Settings reads with fallback %%%%%
// 3-tier fallback: DB → environment → default

/** In-process TTL cache for platform settings to avoid a DB round-trip on every request. */
const SETTING_CACHE_TTL_MS = 60_000; // 1 minute

type CacheEntry = { value: string | null; expiresAt: number };
const settingCache = new Map<string, CacheEntry>();

/** Invalidates the in-process cache for a given key (called after a successful PATCH). */
function invalidateSettingCache(key: string): void {
  settingCache.delete(key);
}

/**
 * Reads a platform setting with a 3-tier fallback and a 60-second in-process TTL cache.
 *
 * Priority order:
 *   1. In-process cache (60-second TTL, invalidated on PATCH)
 *   2. Database value (settings table, type='admin', entity_id IS NULL)
 *   3. Environment variable (envVar parameter)
 *   4. Hardcoded default (defaultValue parameter)
 *
 * Use this for any business rule that should be overridable by operators
 * via environment variable when the DB is not yet configured (fresh deploy, test).
 *
 * @param key - Setting key to read
 * @param envVar - Environment variable name (e.g., PLATFORM_MAX_ADVANCE_BOOKING_DAYS)
 * @param defaultValue - Fallback value if neither DB nor env var is set
 * @returns Setting value from highest-priority source
 */
export async function getPlatformSettingWithFallback(
  key: string,
  envVar: string,
  defaultValue: string
): Promise<string> {
  const cached = settingCache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value ?? process.env[envVar] ?? defaultValue;
  }

  const dbValue = await getPlatformSetting(key);
  settingCache.set(key, { value: dbValue, expiresAt: Date.now() + SETTING_CACHE_TTL_MS });
  return dbValue ?? process.env[envVar] ?? defaultValue;
}


// %%%%% Bulk operations %%%%%
// Read all settings, or update multiple settings

/**
 * Returns all 15 whitelisted platform setting rows with audit metadata.
 *
 * Rows that have never been written are absent from the result.
 * The API layer returns them as-is; the frontend treats missing rows
 * as having no configured value yet.
 *
 * @returns Array of all configured platform settings with audit info
 */
export async function getAllPlatformSettings(): Promise<PlatformSettingRow[]> {
  return repoGetAll();
}

/**
 * Bulk-upserts one or more platform settings.
 *
 * Enforces the cross-key invariant cancellation_penalty_platform_rate +
 * cancellation_penalty_station_rate = 1.00:
 *   - Single key: the complementary key is auto-calculated as (1 - provided value)
 *     and written alongside the provided key in the same upsert.
 *   - Both keys: their sum is validated to equal exactly 1.00.
 *   - Neither key: no rate logic applied, other settings are written as-is.
 *
 * @param data - Validated map of setting keys to new string values
 * @param adminId - UUID of the admin performing the update (from JWT subject claim)
 * @throws ValidationError — provided rate is out of [0, 1] or both rates do not sum to 1.00
 */
export async function updatePlatformSettings(
  data: UpdatePlatformSettingsInput,
  adminId: string
): Promise<void> {
  const PLATFORM_KEY = 'cancellation_penalty_platform_rate';
  const STATION_KEY = 'cancellation_penalty_station_rate';

  const hasPlatform = PLATFORM_KEY in data;
  const hasStation = STATION_KEY in data;

  // Build a mutable copy so we can inject the auto-calculated complementary key.
  const payload: Record<string, string> = { ...data };

  if (hasPlatform && hasStation) {
    // Both provided: validate the sum.
    const platformVal = parseFloat(data[PLATFORM_KEY]!);
    const stationVal = parseFloat(data[STATION_KEY]!);
    if (Number.isFinite(platformVal) && Number.isFinite(stationVal)) {
      const sum = Math.round((platformVal + stationVal) * 100) / 100;
      if (sum !== 1.0) {
        throw new ValidationError(
          `${PLATFORM_KEY} and ${STATION_KEY} must sum to 1.00`
        );
      }
    }
  } else if (hasPlatform) {
    // Only platform rate provided: auto-calculate the station rate.
    const platformVal = parseFloat(data[PLATFORM_KEY]!);
    if (!Number.isFinite(platformVal) || platformVal < 0 || platformVal > 1) {
      throw new ValidationError(
        `${PLATFORM_KEY} must be a decimal between 0.00 and 1.00`
      );
    }
    const complementary = Math.round((1.0 - platformVal) * 100) / 100;
    payload[STATION_KEY] = complementary.toFixed(2);
  } else if (hasStation) {
    // Only station rate provided: auto-calculate the platform rate.
    const stationVal = parseFloat(data[STATION_KEY]!);
    if (!Number.isFinite(stationVal) || stationVal < 0 || stationVal > 1) {
      throw new ValidationError(
        `${STATION_KEY} must be a decimal between 0.00 and 1.00`
      );
    }
    const complementary = Math.round((1.0 - stationVal) * 100) / 100;
    payload[PLATFORM_KEY] = complementary.toFixed(2);
  }

  const entries = Object.entries(payload).map(([key, value]) => ({
    key,
    value,
    updatedBy: adminId,
  }));
  await upsertPlatformSettings(entries);
  // Invalidate cached values so consumers read the new settings within one TTL cycle.
  // Covers both explicitly provided keys and any auto-calculated complementary key.
  for (const key of Object.keys(payload)) {
    invalidateSettingCache(key);
  }
}
