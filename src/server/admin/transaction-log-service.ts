import * as repo from './transaction-log-repository';
import type { TransactionLogFilters } from './transaction-log-repository';

export type { TransactionLog } from './transaction-log-repository';

/**
 * Returns paginated transaction logs with pagination metadata.
 * Aggregates reservations, tips, and penalties from local DB - no Stripe API call needed.
 */
export async function getTransactionLogs(
  filters: TransactionLogFilters,
  page: number,
  perPage: number
) {
  const { logs, total } = await repo.listTransactionLogs(filters, page, perPage);
  return {
    logs,
    meta: {
      total,
      page,
      per_page: perPage,
      total_pages: Math.ceil(total / perPage),
    },
  };
}
