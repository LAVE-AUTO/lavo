import { db } from '@/lib/db';
import { commissionSettings } from '@/lib/db/schema';
import { desc, lte, count } from 'drizzle-orm';

export type CommissionRow = typeof commissionSettings.$inferSelect;
export type NewCommissionRow = typeof commissionSettings.$inferInsert;

/**
 * Returns the active commission row — the most recent entry with effective_at <= now().
 * Returns undefined if no entry has been set yet.
 */
export async function getActiveCommissionRow(): Promise<CommissionRow | undefined> {
  return db.query.commissionSettings.findFirst({
    where: lte(commissionSettings.effective_at, new Date()),
    orderBy: [desc(commissionSettings.effective_at)],
  });
}

/**
 * Inserts a new commission entry. Rows are immutable — updates create new entries.
 */
export async function insertCommissionEntry(data: NewCommissionRow): Promise<CommissionRow> {
  const [row] = await db.insert(commissionSettings).values(data).returning();
  return row;
}

/**
 * Returns paginated commission history ordered by effective_at descending.
 */
export async function listCommissionHistory(
  page: number,
  perPage: number
): Promise<{ rows: CommissionRow[]; total: number }> {
  const offset = (page - 1) * perPage;

  const [rows, totalResult] = await Promise.all([
    db.query.commissionSettings.findMany({
      orderBy: [desc(commissionSettings.effective_at)],
      limit: perPage,
      offset,
    }),
    db.select({ value: count() }).from(commissionSettings),
  ]);

  return { rows, total: Number(totalResult[0]?.value ?? 0) };
}
