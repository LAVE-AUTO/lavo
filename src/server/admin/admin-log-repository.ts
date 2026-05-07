import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { adminLogs } from '@/lib/db/schema';

type InsertAdminLogParams = {
  admin_id: string;
  action: string;
  target_type?: string;
  // target_id must be a valid UUID string - matches the uuid column type in DB.
  target_id?: string;
  details?: Record<string, unknown>;
};

export async function insertAdminLog(params: InsertAdminLogParams): Promise<void> {
  await db.insert(adminLogs).values({
    admin_id: params.admin_id,
    action: params.action,
    target_type: params.target_type ?? null,
    target_id: params.target_id ?? null,
    details: params.details ?? null,
  });
}

/**
 * H-4: Rate limit guard for sensitive admin actions.
 * Returns true if the admin has performed more than maxActions of the given
 * action types within the last windowMs milliseconds.
 */
export async function isAdminActionRateLimited(
  adminId: string,
  actions: string[],
  maxActions = 20,
  windowMs = 60_000
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adminLogs)
    .where(
      and(
        eq(adminLogs.admin_id, adminId),
        inArray(adminLogs.action, actions),
        gt(adminLogs.created_at, since)
      )
    );
  return (rows[0]?.count ?? 0) >= maxActions;
}
