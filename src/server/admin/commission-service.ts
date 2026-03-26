import { DEFAULT_COMMISSION_RATE } from '@/helpers/constants';
import { insertAdminLog } from './admin-log-repository';
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
 * Creates a new commission entry (immutable history — never modifies past rows).
 * Snapshots the current rate as previous_rate, logs the admin action.
 *
 * @param adminId  UUID of the admin performing the change (used for set_by + audit log).
 * @param newRate  New rate as a decimal fraction, already validated and rounded (e.g. 0.1 = 10%).
 */
export async function updateCommission(adminId: string, newRate: number) {
  const current = await repo.getActiveCommissionRow();
  const previousRate = current?.rate ?? DEFAULT_COMMISSION_RATE;

  const entry = await repo.insertCommissionEntry({
    rate: newRate.toFixed(4),
    previous_rate: previousRate,
    set_by: adminId,
    effective_at: new Date(),
  });

  await insertAdminLog({
    admin_id: adminId,
    action: 'commission_rate_updated',
    target_type: 'commission_settings',
    target_id: entry.id,
    details: { previous_rate: previousRate, new_rate: entry.rate },
  });

  return entry;
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
