import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { disputes, stations } from '@/lib/db/schema';
import type { DbTransaction } from '@/lib/db';

export type Dispute = typeof disputes.$inferSelect;

export type DisputeStation = {
  id: string;
  name: string;
  city: string;
  address: string;
};

export type DisputeListItem = Dispute & {
  station: DisputeStation | null;
};

export type CreateDisputeData = {
  reservation_id: string;
  client_id: string;
  station_id: string;
  reason: string;
  description?: string;
  requested_amount?: string;
};

export type UpdateDisputeData = Partial<
  Pick<
    Dispute,
    | 'status'
    | 'refunded_amount'
    | 'stripe_refund_id'
    | 'closed_by'
    | 'closed_reason'
    | 'updated_at'
  >
>;

export type DisputeFilters = {
  status?: 'open' | 'refunded' | 'resolved' | 'rejected';
  station_id?: string;
  client_id?: string;
  date_from?: Date;
  date_to?: Date;
};

export async function findDisputeById(id: string): Promise<Dispute | undefined> {
  return db.query.disputes.findFirst({ where: eq(disputes.id, id) });
}

export async function findDisputeByReservationId(reservationId: string): Promise<Dispute | undefined> {
  return db.query.disputes.findFirst({
    where: eq(disputes.reservation_id, reservationId),
  });
}

export async function createDispute(data: CreateDisputeData): Promise<Dispute> {
  const [dispute] = await db
    .insert(disputes)
    .values({
      reservation_id: data.reservation_id,
      client_id: data.client_id,
      station_id: data.station_id,
      reason: data.reason,
      description: data.description ?? null,
      requested_amount: data.requested_amount ?? null,
      status: 'open',
    })
    .returning();
  return dispute;
}

export async function updateDispute(
  id: string,
  data: UpdateDisputeData,
  tx?: DbTransaction
): Promise<Dispute> {
  const runner = tx ?? db;
  const [updated] = await runner
    .update(disputes)
    .set({ ...data, updated_at: new Date() })
    .where(eq(disputes.id, id))
    .returning();
  return updated;
}

export async function listDisputes(
  filters: DisputeFilters,
  page: number,
  perPage: number
): Promise<{ items: DisputeListItem[]; total: number }> {
  const conditions = [
    filters.status ? eq(disputes.status, filters.status) : undefined,
    filters.station_id ? eq(disputes.station_id, filters.station_id) : undefined,
    filters.client_id ? eq(disputes.client_id, filters.client_id) : undefined,
    filters.date_from ? gte(disputes.created_at, filters.date_from) : undefined,
    filters.date_to ? lte(disputes.created_at, filters.date_to) : undefined,
  ].filter((c): c is NonNullable<typeof c> => c !== undefined);

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (page - 1) * perPage;

  const [rows, [{ value: total }]] = await Promise.all([
    db
      .select({
        dispute: disputes,
        station: {
          id: stations.id,
          name: stations.name,
          city: stations.city,
          address: stations.address,
        },
      })
      .from(disputes)
      .leftJoin(stations, eq(disputes.station_id, stations.id))
      .where(where)
      .orderBy(sql`${disputes.created_at} DESC`)
      .limit(perPage)
      .offset(offset),
    db
      .select({ value: count() })
      .from(disputes)
      .where(where),
  ]);

  const items: DisputeListItem[] = rows.map(({ dispute, station }) => ({
    ...dispute,
    station: station?.id ? (station as DisputeStation) : null,
  }));

  return { items, total: Number(total) };
}
