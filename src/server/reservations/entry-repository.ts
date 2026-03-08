/**
 * Data access for station entries (reservations and queue) in the single reservations table.
 * Enforces entry_type constraints: reservation => time_slot_id set; queue => queue_position set.
 */
import { and, asc, desc, eq, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, timeSlots, stationConfigs } from '@/lib/db/schema';

export type Entry = typeof reservations.$inferSelect;
export type EntryInsert = typeof reservations.$inferInsert;

/** Payload for creating a reservation entry: time_slot_id required. */
export type CreateReservationEntryData = {
  user_id: string;
  station_id: string;
  vehicle_format_id: string;
  time_slot_id: string;
  status: string;
  amount_paid: string;
  commission_rate: string;
  commission_amount?: string | null;
  station_payout?: string | null;
  stripe_payment_id?: string | null;
};

/** Payload for creating a queue entry: queue_position required. */
export type CreateQueueEntryData = {
  user_id: string;
  station_id: string;
  vehicle_format_id: string;
  queue_position: number;
  status: string;
  amount_paid: string;
  commission_rate: string;
  commission_amount?: string | null;
  station_payout?: string | null;
  stripe_payment_id?: string | null;
};

/**
 * Creates a reservation entry. Caller must ensure slot exists and has capacity.
 */
export async function createReservationEntry(
  data: CreateReservationEntryData
): Promise<Entry> {
  const [row] = await db
    .insert(reservations)
    .values({
      user_id: data.user_id,
      station_id: data.station_id,
      vehicle_format_id: data.vehicle_format_id,
      entry_type: 'reservation',
      time_slot_id: data.time_slot_id,
      queue_position: null,
      status: data.status,
      amount_paid: data.amount_paid,
      commission_rate: data.commission_rate,
      commission_amount: data.commission_amount ?? null,
      station_payout: data.station_payout ?? null,
      stripe_payment_id: data.stripe_payment_id ?? null,
    })
    .returning();
  if (!row) throw new Error('Insert reservation entry failed');
  return row;
}

/**
 * Creates a queue entry. Caller must ensure queue_position is the next available (e.g. end of queue).
 */
export async function createQueueEntry(data: CreateQueueEntryData): Promise<Entry> {
  const [row] = await db
    .insert(reservations)
    .values({
      user_id: data.user_id,
      station_id: data.station_id,
      vehicle_format_id: data.vehicle_format_id,
      entry_type: 'queue',
      time_slot_id: null,
      queue_position: data.queue_position,
      status: data.status,
      amount_paid: data.amount_paid,
      commission_rate: data.commission_rate,
      commission_amount: data.commission_amount ?? null,
      station_payout: data.station_payout ?? null,
      stripe_payment_id: data.stripe_payment_id ?? null,
    })
    .returning();
  if (!row) throw new Error('Insert queue entry failed');
  return row;
}

/**
 * Returns the entry by id, or undefined.
 */
export async function findEntryById(id: string): Promise<Entry | undefined> {
  return db.query.reservations.findFirst({
    where: eq(reservations.id, id),
  });
}

/**
 * Returns the entry by id only if it belongs to the given user.
 */
export async function findEntryByIdAndUser(
  id: string,
  userId: string
): Promise<Entry | undefined> {
  return db.query.reservations.findFirst({
    where: and(eq(reservations.id, id), eq(reservations.user_id, userId)),
  });
}

/**
 * Returns the entry by id only if it belongs to the given station.
 */
export async function findEntryByIdAndStation(
  id: string,
  stationId: string
): Promise<Entry | undefined> {
  return db.query.reservations.findFirst({
    where: and(eq(reservations.id, id), eq(reservations.station_id, stationId)),
  });
}

/**
 * Lists all entries for a station: reservations (by time_slot start_time) then queue (by queue_position).
 */
export async function listEntriesByStation(stationId: string): Promise<Entry[]> {
  const rows = await db
    .select({
      id: reservations.id,
      user_id: reservations.user_id,
      entry_type: reservations.entry_type,
      time_slot_id: reservations.time_slot_id,
      station_id: reservations.station_id,
      vehicle_format_id: reservations.vehicle_format_id,
      status: reservations.status,
      queue_position: reservations.queue_position,
      amount_paid: reservations.amount_paid,
      commission_rate: reservations.commission_rate,
      commission_amount: reservations.commission_amount,
      station_payout: reservations.station_payout,
      tip_amount: reservations.tip_amount,
      stripe_payment_id: reservations.stripe_payment_id,
      stripe_transfer_id: reservations.stripe_transfer_id,
      cancellation_reason: reservations.cancellation_reason,
      penalty_amount: reservations.penalty_amount,
      confirmed_at: reservations.confirmed_at,
      completed_at: reservations.completed_at,
      created_at: reservations.created_at,
      updated_at: reservations.updated_at,
    })
    .from(reservations)
    .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .where(eq(reservations.station_id, stationId))
    .orderBy(
      desc(reservations.entry_type),
      asc(timeSlots.start_time),
      asc(reservations.queue_position)
    );
  return rows as Entry[];
}

/**
 * Lists queue-only entries for a station, ordered by queue_position.
 */
export async function listQueueByStation(stationId: string): Promise<Entry[]> {
  return db.query.reservations.findMany({
    where: and(
      eq(reservations.station_id, stationId),
      eq(reservations.entry_type, 'queue')
    ),
    orderBy: asc(reservations.queue_position),
  });
}

/**
 * Returns the count of queue entries for the station (for queue-position helper context).
 */
export async function countQueueByStation(stationId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(
      and(
        eq(reservations.station_id, stationId),
        eq(reservations.entry_type, 'queue')
      )
    );
  return result[0]?.count ?? 0;
}

/**
 * Returns the max queue_position for the station, or 0 if no queue entries.
 */
export async function getNextQueuePosition(stationId: string): Promise<number> {
  const result = await db
    .select({
      max: sql<number | null>`max(${reservations.queue_position})::int`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.station_id, stationId),
        eq(reservations.entry_type, 'queue')
      )
    );
  const max = result[0]?.max ?? 0;
  return (max ?? 0) + 1;
}

/**
 * Lists all entries for a user (reservations and queue), most recent first.
 */
export async function listEntriesByUser(userId: string): Promise<Entry[]> {
  return db.query.reservations.findMany({
    where: eq(reservations.user_id, userId),
    orderBy: (r, { desc }) => [desc(r.created_at)],
  });
}

/**
 * Updates an entry. Respects entry_type: when setting entry_type to 'reservation', time_slot_id
 * must be set and queue_position cleared; when setting to 'queue', queue_position must be set
 * and time_slot_id cleared. Caller is responsible for passing valid combinations.
 */
export async function updateEntry(
  id: string,
  data: Partial<{
    status: string;
    entry_type: 'reservation' | 'queue';
    time_slot_id: string | null;
    queue_position: number | null;
    confirmed_at: Date | null;
    completed_at: Date | null;
    cancellation_reason: string | null;
    updated_at: Date;
  }>
): Promise<Entry> {
  const payload = { ...data, updated_at: data.updated_at ?? new Date() };
  const [row] = await db
    .update(reservations)
    .set(payload as Record<string, unknown>)
    .where(eq(reservations.id, id))
    .returning();
  if (!row) throw new Error('Update entry failed');
  return row;
}

/**
 * Shifts queue positions for a station: entries with queue_position >= fromPosition get +delta.
 * Used when inserting at a specific position (e.g. middle_of_queue) or reordering.
 */
export async function shiftQueuePositions(
  stationId: string,
  fromPosition: number,
  delta: number
): Promise<void> {
  if (delta === 0) return;
  await db
    .update(reservations)
    .set({
      queue_position: sql`${reservations.queue_position} + ${delta}`,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(reservations.station_id, stationId),
        eq(reservations.entry_type, 'queue'),
        gte(reservations.queue_position, fromPosition)
      )
    );
}

/**
 * Lists reservation entries that are past the station's late_tolerance (unconfirmed).
 * Used by cron to downgrade them to queue. Joins time_slots and station_configs.
 */
export async function listLateUnconfirmedReservations(): Promise<Entry[]> {
  const now = new Date();
  const rows = await db
    .select({
      id: reservations.id,
      user_id: reservations.user_id,
      entry_type: reservations.entry_type,
      time_slot_id: reservations.time_slot_id,
      station_id: reservations.station_id,
      vehicle_format_id: reservations.vehicle_format_id,
      status: reservations.status,
      queue_position: reservations.queue_position,
      amount_paid: reservations.amount_paid,
      commission_rate: reservations.commission_rate,
      commission_amount: reservations.commission_amount,
      station_payout: reservations.station_payout,
      tip_amount: reservations.tip_amount,
      stripe_payment_id: reservations.stripe_payment_id,
      stripe_transfer_id: reservations.stripe_transfer_id,
      cancellation_reason: reservations.cancellation_reason,
      penalty_amount: reservations.penalty_amount,
      confirmed_at: reservations.confirmed_at,
      completed_at: reservations.completed_at,
      created_at: reservations.created_at,
      updated_at: reservations.updated_at,
    })
    .from(reservations)
    .innerJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .innerJoin(stationConfigs, eq(reservations.station_id, stationConfigs.id))
    .where(
      and(
        eq(reservations.entry_type, 'reservation'),
        eq(reservations.status, 'pending'),
        sql`(${timeSlots.start_time} + (${stationConfigs.late_tolerance_minutes} * interval '1 minute')) < ${now}`
      )
    );
  return rows as Entry[];
}
