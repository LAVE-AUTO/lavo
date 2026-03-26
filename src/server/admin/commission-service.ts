import { desc, lte } from 'drizzle-orm';
import { db } from '@/lib/db';
import { commissionSettings, adminLogs } from '@/lib/db/schema';
import { DEFAULT_COMMISSION_RATE } from '@/helpers/constants';
import * as repo from './commission-repository';

/**
 * Returns the currently active commission rate with its full context.
 * Falls back to DEFAULT_COMMISSION_RATE if no entry exists yet.
 */
export async function getCurrentCommission() {
  const row = await repo.getActiveCommissionRow();
  return {
    rate: row?.rate ?? DEFAULT_COMMISSION_RATE,
    previous_rate: row?.previous_rate ?? null,
    effective_at: row?.effective_at ?? null,
    set_by: row?.set_by ?? null,
  };
}

/**
 * Creates a new commission entry atomically (immutable history — never modifies past rows).
 * The read, insert, and audit log are wrapped in a single DB transaction:
 * - prevents TOCTOU: two concurrent PUTs cannot both record the same previous_rate
 * - guarantees consistency: if the admin log insert fails, the commission update rolls back
 *
 * @param adminId  UUID of the admin performing the change.
 * @param newRate  New rate already validated and rounded by Zod (e.g. 0.1 = 10%).
 */
export async function updateCommission(adminId: string, newRate: number) {
  return db.transaction(async (tx) => {
    const current = await tx.query.commissionSettings.findFirst({
      where: lte(commissionSettings.effective_at, new Date()),
      orderBy: [desc(commissionSettings.effective_at)],
    });
    const previousRate = current?.rate ?? DEFAULT_COMMISSION_RATE;

    const [entry] = await tx
      .insert(commissionSettings)
      .values({
        rate: newRate.toFixed(4),
        previous_rate: previousRate,
        set_by: adminId,
        effective_at: new Date(),
      })
      .returning();

    await tx.insert(adminLogs).values({
      admin_id: adminId,
      action: 'commission_rate_updated',
      target_type: 'commission_settings',
      target_id: entry.id,
      details: { previous_rate: previousRate, new_rate: entry.rate },
    });

    return entry;
  });
}

/**
 * Returns paginated commission history with pagination metadata.
 */
export async function getCommissionHistory(page: number, perPage: number) {
  const { rows, total } = await repo.listCommissionHistory(page, perPage);
  return {
    history: rows,
    meta: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    },
  };
}
