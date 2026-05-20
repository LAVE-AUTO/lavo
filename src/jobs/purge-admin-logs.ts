import { lt, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { adminLogs } from '@/lib/db/schema';
import { getPlatformSettingWithFallback } from '@/server/admin/platform-settings-service';

const DEFAULT_RETENTION_DAYS = 365;
const MIN_RETENTION_DAYS     = 7;

export type PurgeAdminLogsResult = {
  deleted: number;
  retention_days: number;
  cutoff: string;
};

/**
 * Deletes admin_logs rows older than the configured retention window.
 *
 * Retention is read from the `admin_log_retention_days` platform setting
 * (DB → PLATFORM_ADMIN_LOG_RETENTION_DAYS env var → 365-day default).
 * A hard floor of 7 days prevents misconfiguration from wiping recent logs.
 */
export async function runPurgeAdminLogs(): Promise<PurgeAdminLogsResult> {
  const raw = await getPlatformSettingWithFallback(
    'admin_log_retention_days',
    'PLATFORM_ADMIN_LOG_RETENTION_DAYS',
    String(DEFAULT_RETENTION_DAYS),
  );

  const parsed = parseInt(raw, 10);
  const retentionDays = Number.isFinite(parsed) && parsed >= MIN_RETENTION_DAYS
    ? parsed
    : DEFAULT_RETENTION_DAYS;

  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(adminLogs)
    .where(lt(adminLogs.created_at, cutoff))
    .returning({ id: sql<string>`id` });

  return {
    deleted: result.length,
    retention_days: retentionDays,
    cutoff: cutoff.toISOString(),
  };
}
