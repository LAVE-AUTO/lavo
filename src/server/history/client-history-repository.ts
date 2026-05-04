/**
 * Data access for client history and receipt details.
 */
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, stations, vehicleFormats, timeSlots, stationPhotos } from '@/lib/db/schema';
import type { ClientHistoryAllowedStatus } from '@/validators/history';

export type ClientHistoryRepositoryFilters = {
  userId: string;
  statuses: ClientHistoryAllowedStatus[];
  page: number;
  limit: number;
  entry_type?: 'reservation' | 'queue';
  from?: string;
  to?: string;
  amount_min?: number;
  amount_max?: number;
  q?: string;
  sort_by: 'created_at' | 'amount_paid' | 'status';
  sort_order: 'asc' | 'desc';
};

export type ClientHistoryRepositoryItem = {
  id: string;
  created_at: Date;
  status: string;
  entry_type: 'reservation' | 'queue';
  amount_paid: string;
  commission_amount: string | null;
  tip_amount: string | null;
  stripe_payment_id: string | null;
  station_name: string | null;
  station_address: string | null;
  station_city: string | null;
  station_image_url: string | null;
  vehicle_format_label: string | null;
  slot_start_time: Date | null;
};

export type ClientHistoryRepositoryResult = {
  items: ClientHistoryRepositoryItem[];
  total: number;
};

export type ClientHistoryReceiptRow = ClientHistoryRepositoryItem;

function parseQueryDateFormats(q: string): { iso?: string; fr?: string } {
  const trimmed = q.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoMatch) {
    return { iso: trimmed };
  }

  const frMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed);
  if (frMatch) {
    const [, dd, mm, yyyy] = frMatch;
    return { fr: `${dd}/${mm}/${yyyy}`, iso: `${yyyy}-${mm}-${dd}` };
  }

  return {};
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Lists paginated client history rows for the authenticated user.
 */
export async function listClientHistory(
  filters: ClientHistoryRepositoryFilters
): Promise<ClientHistoryRepositoryResult> {
  const { userId, statuses, page, limit, entry_type, from, to, amount_min, amount_max, q, sort_by, sort_order } =
    filters;

  const conditions = [eq(reservations.user_id, userId), inArray(reservations.status, statuses)];

  if (entry_type) {
    conditions.push(eq(reservations.entry_type, entry_type));
  }
  if (from) {
    conditions.push(gte(reservations.created_at, new Date(from + 'T00:00:00.000Z')));
  }
  if (to) {
    conditions.push(lte(reservations.created_at, new Date(to + 'T23:59:59.999Z')));
  }
  if (amount_min !== undefined) {
    conditions.push(sql`${reservations.amount_paid}::numeric >= ${amount_min}`);
  }
  if (amount_max !== undefined) {
    conditions.push(sql`${reservations.amount_paid}::numeric <= ${amount_max}`);
  }

  if (q) {
    const qLike = `%${escapeLikePattern(q.trim())}%`;
    const qDates = parseQueryDateFormats(q);

    conditions.push(
      or(
        sql`${stations.name} ILIKE ${qLike} ESCAPE '\\'`,
        sql`${stations.city} ILIKE ${qLike} ESCAPE '\\'`,
        sql`${vehicleFormats.label} ILIKE ${qLike} ESCAPE '\\'`,
        sql`${reservations.status} ILIKE ${qLike} ESCAPE '\\'`,
        qDates.iso ? sql`to_char(${reservations.created_at}, 'YYYY-MM-DD') = ${qDates.iso}` : undefined,
        qDates.fr ? sql`to_char(${reservations.created_at}, 'DD/MM/YYYY') = ${qDates.fr}` : undefined
      )!
    );
  }

  const where = and(...conditions);
  const offset = (page - 1) * limit;

  const sortSqlColumn =
    sort_by === 'amount_paid'
      ? sql`${reservations.amount_paid}::numeric`
      : sort_by === 'status'
        ? reservations.status
        : reservations.created_at;
  const orderByPrimary = sort_order === 'asc' ? asc(sortSqlColumn) : desc(sortSqlColumn);

  const [countResult, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(distinct ${reservations.id})::int` })
      .from(reservations)
      .leftJoin(stations, eq(reservations.station_id, stations.id))
      .leftJoin(vehicleFormats, eq(reservations.vehicle_format_id, vehicleFormats.id))
      .where(where),
    db
      .select({
        id: reservations.id,
        created_at: reservations.created_at,
        status: reservations.status,
        entry_type: reservations.entry_type,
        amount_paid: reservations.amount_paid,
        commission_amount: reservations.commission_amount,
        tip_amount: reservations.tip_amount,
        stripe_payment_id: reservations.stripe_payment_id,
        station_name: stations.name,
        station_address: stations.address,
        station_city: stations.city,
        station_image_url: sql<string | null>`(SELECT ${stationPhotos.url} FROM station_photos WHERE station_photos.station_id = ${reservations.station_id} ORDER BY station_photos.position ASC LIMIT 1)`,
        vehicle_format_label: vehicleFormats.label,
        slot_start_time: timeSlots.start_time,
      })
      .from(reservations)
      .leftJoin(stations, eq(reservations.station_id, stations.id))
      .leftJoin(vehicleFormats, eq(reservations.vehicle_format_id, vehicleFormats.id))
      .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
      .where(where)
      .orderBy(orderByPrimary)
      .limit(limit)
      .offset(offset),
  ]);

  return {
    items: rows as ClientHistoryRepositoryItem[],
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * Returns one history row by id, scoped to the authenticated user.
 */
export async function findClientHistoryReceiptByEntryId(
  userId: string,
  entryId: string
): Promise<ClientHistoryReceiptRow | undefined> {
  const rows = await db
    .select({
      id: reservations.id,
      created_at: reservations.created_at,
      status: reservations.status,
      entry_type: reservations.entry_type,
      amount_paid: reservations.amount_paid,
      commission_amount: reservations.commission_amount,
      tip_amount: reservations.tip_amount,
      stripe_payment_id: reservations.stripe_payment_id,
      station_name: stations.name,
      station_address: stations.address,
      station_city: stations.city,
      station_image_url: sql<string | null>`(SELECT ${stationPhotos.url} FROM station_photos WHERE station_photos.station_id = ${reservations.station_id} ORDER BY station_photos.position ASC LIMIT 1)`,
      vehicle_format_label: vehicleFormats.label,
      slot_start_time: timeSlots.start_time,
    })
    .from(reservations)
    .leftJoin(stations, eq(reservations.station_id, stations.id))
    .leftJoin(vehicleFormats, eq(reservations.vehicle_format_id, vehicleFormats.id))
    .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .where(and(eq(reservations.id, entryId), eq(reservations.user_id, userId)))
    .limit(1);

  return rows[0] as ClientHistoryReceiptRow | undefined;
}
