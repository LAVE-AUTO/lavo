import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export type TransactionType = 'reservation' | 'tip' | 'penalty';

export type TransactionLog = {
  type: TransactionType;
  id: string;
  station_id: string;
  station_name: string | null;
  amount: string;
  /** Platform commission taken. Only applies to reservations. */
  commission_amount: string | null;
  status: string;
  created_at: Date;
};

export type TransactionLogFilters = {
  type?: TransactionType;
  station_id?: string;
  date_from?: Date;
  date_to?: Date;
};

/**
 * Returns paginated transaction logs aggregated from reservations, tips, and penalties.
 * Uses a SQL UNION ALL with a window COUNT to retrieve total in a single round-trip.
 *
 * Each sub-select is filtered independently; the type filter excludes irrelevant sub-selects
 * via a SQL condition so the planner can skip the full table scan.
 *
 * Deployment dependency: the `reservation_tips` table is created by the tip feature migration
 * (feat/api-pourboire). This query will fail at runtime if that migration has not been applied.
 */
export async function listTransactionLogs(
  filters: TransactionLogFilters,
  page: number,
  perPage: number
): Promise<{ logs: TransactionLog[]; total: number }> {
  const offset = (page - 1) * perPage;

  // Nullable params — when null, the WHERE condition is always TRUE (no filter applied).
  const typeParam = filters.type ?? null;
  const stationParam = filters.station_id ?? null;
  const dateFromParam = filters.date_from ?? null;
  const dateToParam = filters.date_to ?? null;

  const query = sql`
    WITH logs AS (
      SELECT
        'reservation'::text             AS type,
        r.id::text                      AS id,
        r.station_id::text              AS station_id,
        s.name                          AS station_name,
        r.amount_paid::text             AS amount,
        r.commission_amount::text       AS commission_amount,
        r.status,
        r.created_at
      FROM reservations r
      LEFT JOIN stations s ON s.id = r.station_id
      WHERE (${typeParam}::text IS NULL OR ${typeParam}::text = 'reservation')
        AND (${stationParam}::uuid IS NULL OR r.station_id = ${stationParam}::uuid)
        AND (${dateFromParam}::timestamptz IS NULL OR r.created_at >= ${dateFromParam}::timestamptz)
        AND (${dateToParam}::timestamptz IS NULL OR r.created_at <= ${dateToParam}::timestamptz)

      UNION ALL

      SELECT
        'tip'::text                     AS type,
        t.id::text                      AS id,
        t.station_id::text              AS station_id,
        s.name                          AS station_name,
        t.amount::text                  AS amount,
        NULL::text                      AS commission_amount,
        t.status,
        t.created_at
      FROM reservation_tips t
      LEFT JOIN stations s ON s.id = t.station_id
      WHERE (${typeParam}::text IS NULL OR ${typeParam}::text = 'tip')
        AND (${stationParam}::uuid IS NULL OR t.station_id = ${stationParam}::uuid)
        AND (${dateFromParam}::timestamptz IS NULL OR t.created_at >= ${dateFromParam}::timestamptz)
        AND (${dateToParam}::timestamptz IS NULL OR t.created_at <= ${dateToParam}::timestamptz)

      UNION ALL

      SELECT
        'penalty'::text                 AS type,
        f.id::text                      AS id,
        f.station_id::text              AS station_id,
        s.name                          AS station_name,
        f.amount::text                  AS amount,
        NULL::text                      AS commission_amount,
        f.status,
        f.created_at
      FROM no_show_fees f
      LEFT JOIN stations s ON s.id = f.station_id
      WHERE (${typeParam}::text IS NULL OR ${typeParam}::text = 'penalty')
        AND (${stationParam}::uuid IS NULL OR f.station_id = ${stationParam}::uuid)
        AND (${dateFromParam}::timestamptz IS NULL OR f.created_at >= ${dateFromParam}::timestamptz)
        AND (${dateToParam}::timestamptz IS NULL OR f.created_at <= ${dateToParam}::timestamptz)
    )
    SELECT
      type,
      id,
      station_id,
      station_name,
      amount,
      commission_amount,
      status,
      created_at,
      COUNT(*) OVER() AS total_count
    FROM logs
    ORDER BY created_at DESC
    LIMIT ${perPage} OFFSET ${offset}
  `;

  const result = await db.execute(query);

  type RawRow = {
    type: string;
    id: string;
    station_id: string;
    station_name: string | null;
    amount: string;
    commission_amount: string | null;
    status: string;
    created_at: Date;
    total_count: string;
  };

  const rows = result.rows as RawRow[];
  const total = rows.length > 0 ? parseInt(rows[0].total_count, 10) : 0;

  const logs: TransactionLog[] = rows.map((row) => ({
    type: row.type as TransactionType,
    id: row.id,
    station_id: row.station_id,
    station_name: row.station_name,
    amount: row.amount,
    commission_amount: row.commission_amount,
    status: row.status,
    created_at: new Date(row.created_at),
  }));

  return { logs, total };
}
