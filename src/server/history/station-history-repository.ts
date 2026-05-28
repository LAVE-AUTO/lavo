/**
 * Data access for station activity history.
 * Aggregates reservations with their financial data, joined with client info and vehicle format.
 */
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, users, vehicleFormats, stationServices } from '@/lib/db/schema';

export type StationHistoryFilters = {
  stationId: string;
  page: number;
  limit: number;
  from?: string;
  to?: string;
  status?: string;
  amount_min?: number;
  amount_max?: number;
};

export type StationHistoryItem = {
  id: string;
  date: Date;
  entry_type: 'reservation' | 'queue';
  status: string;
  // Client info
  client_first_name: string | null;
  client_last_name: string | null;
  // Service info (service_name is the merchant-set label from station_services.name)
  vehicle_format_label: string | null;
  service_name: string | null;
  service_category: string | null;
  // Financial data
  amount_paid: string;
  station_payout: string | null;
  commission_rate: string;
  commission_amount: string | null;
  tip_amount: string | null;
  penalty_amount: string | null;
  stripe_payment_id: string | null;
};

export type StationHistoryResult = {
  items: StationHistoryItem[];
  total: number;
};

/**
 * Returns paginated activity history for a station, including reservation and financial data.
 * Results are sorted by created_at DESC.
 */
export async function listStationHistory(
  filters: StationHistoryFilters
): Promise<StationHistoryResult> {
  const { stationId, page, limit, from, to, status, amount_min, amount_max } = filters;

  const conditions = [eq(reservations.station_id, stationId)];

  if (from) {
    conditions.push(gte(reservations.created_at, new Date(from + 'T00:00:00.000Z')));
  }
  if (to) {
    conditions.push(lte(reservations.created_at, new Date(to + 'T23:59:59.999Z')));
  }
  if (status) {
    conditions.push(eq(reservations.status, status));
  }
  if (amount_min !== undefined) {
    conditions.push(sql`${reservations.amount_paid}::numeric >= ${amount_min}`);
  }
  if (amount_max !== undefined) {
    conditions.push(sql`${reservations.amount_paid}::numeric <= ${amount_max}`);
  }

  const where = and(...conditions);
  const offset = (page - 1) * limit;

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .where(where),
    db
      .select({
        id: reservations.id,
        date: reservations.created_at,
        entry_type: reservations.entry_type,
        status: reservations.status,
        client_first_name: users.first_name,
        client_last_name: users.last_name,
        vehicle_format_label: vehicleFormats.label,
        service_name: stationServices.name,
        service_category: stationServices.category,
        amount_paid: reservations.amount_paid,
        station_payout: reservations.station_payout,
        commission_rate: reservations.commission_rate,
        commission_amount: reservations.commission_amount,
        tip_amount: reservations.tip_amount,
        penalty_amount: reservations.penalty_amount,
        stripe_payment_id: reservations.stripe_payment_id,
      })
      .from(reservations)
      .leftJoin(users, eq(reservations.user_id, users.id))
      .leftJoin(vehicleFormats, eq(reservations.vehicle_format_id, vehicleFormats.id))
      .leftJoin(stationServices, eq(reservations.service_id, stationServices.id))
      .where(where)
      .orderBy(desc(reservations.created_at))
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items: rows as StationHistoryItem[],
    total: countResult[0]?.count ?? 0,
  };
}
