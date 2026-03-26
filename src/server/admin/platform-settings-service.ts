/**
 * Platform-wide settings service.
 * Settings are stored in the `settings` table with type='admin' and entity_id=null (global).
 *
 * Cancellation policy keys (seeded in DB, editable via admin panel):
 *   - cancellation_free_window_minutes: 60   (free cancellation if >= 60 min before service)
 *   - cancellation_penalty_percent: 20        (% of amount_paid kept as penalty if late)
 *
 * Penalty distribution (how the retained penalty is split):
 *   - cancellation_penalty_platform_rate: 70  (% of penalty kept by the platform)
 *   - cancellation_penalty_station_rate: 30   (% of penalty kept by the station)
 *
 * Stripe mechanics for late cancellation:
 *   1. Refund the client (refundable amount) — comes from platform balance, reverse_transfer: false.
 *   2. Reverse the station transfer for (penalty - station_share) to claw back platform's portion.
 *   Result: platform nets its penalty share, station nets its penalty share.
 */
import { eq, and, isNull, lte, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { settings, commissionSettings } from '@/lib/db/schema';
import { DEFAULT_COMMISSION_RATE } from '@/helpers/server-constants';
import { isTruePlatformSetting } from '@/helpers/platform-setting-boolean';

export type CancellationPolicy = {
  freeWindowMinutes: number;
  penaltyRate: number;
  platformPenaltyShare: number; // fraction [0, 1] of penalty kept by platform
  stationPenaltyShare: number;  // fraction [0, 1] of penalty kept by station
};

const DEFAULTS: CancellationPolicy = {
  freeWindowMinutes: 60,
  penaltyRate: 0.2,
  platformPenaltyShare: 0.7, // 70%
  stationPenaltyShare: 0.3,  // 30%
};

/** Commission rate must be in [0, 1] to avoid negative payouts or invalid splits. */
const COMMISSION_RATE_MIN = 0;
const COMMISSION_RATE_MAX = 1;

/**
 * Returns the active platform commission rate as a decimal string (e.g. '0.1000').
 * Reads the most recent commissionSettings row with effective_at <= now().
 * Falls back to DEFAULT_COMMISSION_RATE if no row is configured yet.
 * Clamps rate to [0, 1] to prevent injection of invalid values from DB.
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
 * Whether admin FCM push on escrow release is enabled.
 * Canonical key: stripe_admin_notifications_enabled.
 * Legacy fallback: enable_admin_push_on_escrow_released (when canonical row is absent).
 */
export async function isAdminEscrowPushEnabled(): Promise<boolean> {
  const canonical = await getPlatformSetting('stripe_admin_notifications_enabled');
  if (canonical !== null) return isTruePlatformSetting(canonical);

  const legacy = await getPlatformSetting('enable_admin_push_on_escrow_released');
  return isTruePlatformSetting(legacy);
}

/**
 * Returns the active cancellation policy from platform settings.
 * Falls back to defaults if settings are not configured.
 */
export async function getCancellationPolicy(): Promise<CancellationPolicy> {
  const [windowRaw, percentRaw, platformRaw, stationRaw] = await Promise.all([
    getPlatformSetting('cancellation_free_window_minutes'),
    getPlatformSetting('cancellation_penalty_percent'),
    getPlatformSetting('cancellation_penalty_platform_rate'),
    getPlatformSetting('cancellation_penalty_station_rate'),
  ]);

  const freeWindowMinutes = windowRaw ? parseInt(windowRaw, 10) : DEFAULTS.freeWindowMinutes;
  // DB stores as percentage (e.g. "20"), convert to rate (0.20), clamped to [0, 1].
  const rawRate = percentRaw ? parseFloat(percentRaw) / 100 : DEFAULTS.penaltyRate;

  const rawPlatformShare = platformRaw ? parseFloat(platformRaw) / 100 : DEFAULTS.platformPenaltyShare;
  const rawStationShare = stationRaw ? parseFloat(stationRaw) / 100 : DEFAULTS.stationPenaltyShare;
  // Clamp each share to [0, 1]; if they don't sum to 1, normalise.
  const pShare = Number.isFinite(rawPlatformShare) ? Math.min(1, Math.max(0, rawPlatformShare)) : DEFAULTS.platformPenaltyShare;
  const sShare = Number.isFinite(rawStationShare) ? Math.min(1, Math.max(0, rawStationShare)) : DEFAULTS.stationPenaltyShare;
  const total = pShare + sShare;
  const platformPenaltyShare = total > 0 ? pShare / total : DEFAULTS.platformPenaltyShare;
  const stationPenaltyShare = total > 0 ? sShare / total : DEFAULTS.stationPenaltyShare;

  return {
    freeWindowMinutes: Number.isFinite(freeWindowMinutes) && freeWindowMinutes > 0 ? freeWindowMinutes : DEFAULTS.freeWindowMinutes,
    penaltyRate: Number.isFinite(rawRate) ? Math.min(1, Math.max(0, rawRate)) : DEFAULTS.penaltyRate,
    platformPenaltyShare,
    stationPenaltyShare,
  };
}
