import { and, count, desc, eq, gte, gt, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { adminLogs, users } from '@/lib/db/schema';

export type AdminLogEntry = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: Date;
  admin_id: string;
  admin_name: string;
  admin_email: string;
};

export type AdminLogFilters = {
  action?: string;
  admin_id?: string;
  date_from?: Date;
  date_to?: Date;
};

export async function listAdminLogs(
  filters: AdminLogFilters,
  page: number,
  perPage: number,
): Promise<{ items: AdminLogEntry[]; total: number }> {
  const conditions = [
    filters.action     ? eq(adminLogs.action, filters.action)         : undefined,
    filters.admin_id   ? eq(adminLogs.admin_id, filters.admin_id)     : undefined,
    filters.date_from  ? gte(adminLogs.created_at, filters.date_from) : undefined,
    filters.date_to    ? lte(adminLogs.created_at, filters.date_to)   : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        id:           adminLogs.id,
        action:       adminLogs.action,
        target_type:  adminLogs.target_type,
        target_id:    adminLogs.target_id,
        details:      adminLogs.details,
        created_at:   adminLogs.created_at,
        admin_id:     adminLogs.admin_id,
        admin_first:  users.first_name,
        admin_last:   users.last_name,
        admin_email:  users.email,
      })
      .from(adminLogs)
      .leftJoin(users, eq(adminLogs.admin_id, users.id))
      .where(where)
      .orderBy(desc(adminLogs.created_at))
      .limit(perPage)
      .offset(offset),
    db.select({ value: count() }).from(adminLogs).where(where),
  ]);

  const items: AdminLogEntry[] = rows.map((r) => ({
    id:          r.id,
    action:      r.action,
    target_type: r.target_type,
    target_id:   r.target_id,
    details:     r.details as Record<string, unknown> | null,
    created_at:  r.created_at,
    admin_id:    r.admin_id,
    admin_name:  [r.admin_first, r.admin_last].filter(Boolean).join(' ') || r.admin_email || r.admin_id,
    admin_email: r.admin_email || '',
  }));

  return { items, total: Number(total) };
}

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
