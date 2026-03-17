/**
 * Data access for station entries (reservations and queue) in the single reservations table.
 * Enforces entry_type constraints: reservation => time_slot_id set; queue => queue_position set.
 */
import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db, type DbTransaction } from '@/lib/db';
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
  data: CreateReservationEntryData,
  tx?: DbTransaction
): Promise<Entry> {
  const client = tx ?? db;
  const [row] = await client
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
  userId: string,
  tx?: DbTransaction
): Promise<Entry | undefined> {
  const client = tx ?? db;
  return client.query.reservations.findFirst({
    where: and(eq(reservations.id, id), eq(reservations.user_id, userId)),
  });
}

export type EntryWithSlot = Entry & {
  slotStartTime: Date | null;
};

/**
 * Returns a reservation entry with its time_slot start_time. Used for cancellation policy checks.
 */
export async function findReservationWithSlot(
  id: string,
  userId: string
): Promise<EntryWithSlot | undefined> {
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
      stripe_refund_id: reservations.stripe_refund_id,
      cancellation_reason: reservations.cancellation_reason,
      penalty_amount: reservations.penalty_amount,
      confirmed_at: reservations.confirmed_at,
      completed_at: reservations.completed_at,
      created_at: reservations.created_at,
      updated_at: reservations.updated_at,
      slotStartTime: timeSlots.start_time,
    })
    .from(reservations)
    .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .where(and(eq(reservations.id, id), eq(reservations.user_id, userId)))
    .limit(1);
  return rows[0] as EntryWithSlot | undefined;
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

/** Non-terminal statuses considered "active" for duplicate reservation checks. */
const ACTIVE_STATUSES = ['pending_payment', 'pending', 'confirmed', 'in_progress'];

/**
 * Returns true if the user already has an active reservation or queue entry at this station.
 */
export async function hasActiveEntryAtStation(
  userId: string,
  stationId: string,
  tx?: DbTransaction
): Promise<boolean> {
  const client = tx ?? db;
  const row = await client
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.user_id, userId),
        eq(reservations.station_id, stationId),
        inArray(reservations.status, ACTIVE_STATUSES)
      )
    )
    .limit(1);
  return row.length > 0;
}

/**
 * Finds an entry by its Stripe payment ID. Used by webhook handler.
 */
export async function findEntryByStripePaymentId(
  stripePaymentId: string
): Promise<Entry | undefined> {
  return db.query.reservations.findFirst({
    where: eq(reservations.stripe_payment_id, stripePaymentId),
  });
}

/** Pagination + filter options for entry listing. */
export type ListEntriesFilters = {
  status?: string;
  from?: Date;
  to?: Date;
  page?: number;
  per_page?: number;
};

export type PaginatedEntries = {
  rows: Entry[];
  total: number;
  page: number;
  per_page: number;
};

/**
 * Lists entries for a user with pagination and optional status/date filters.
 */
export async function listEntriesByUserPaginated(
  userId: string,
  filters: ListEntriesFilters = {}
): Promise<PaginatedEntries> {
  const { status, from, to, page = 1, per_page = 20 } = filters;
  const limit = Math.min(Math.max(1, per_page), 100);
  const offset = (Math.max(1, page) - 1) * limit;

  const conditions = [eq(reservations.user_id, userId)];
  if (status) conditions.push(eq(reservations.status, status));
  if (from) conditions.push(gte(reservations.created_at, from));
  if (to) conditions.push(lte(reservations.created_at, to));

  const where = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(reservations).where(where),
    db.query.reservations.findMany({
      where,
      orderBy: (r, { desc }) => [desc(r.created_at)],
      limit,
      offset,
    }),
  ]);

  return { rows, total: countRows[0]?.count ?? 0, page, per_page: limit };
}

/**
 * Lists entries for a station with pagination and optional status/date filters.
 */
export async function listEntriesByStationPaginated(
  stationId: string,
  filters: ListEntriesFilters = {}
): Promise<PaginatedEntries> {
  const { status, from, to, page = 1, per_page = 20 } = filters;
  const limit = Math.min(Math.max(1, per_page), 100);
  const offset = (Math.max(1, page) - 1) * limit;

  const conditions = [eq(reservations.station_id, stationId)];
  if (status) conditions.push(eq(reservations.status, status));
  if (from) conditions.push(gte(reservations.created_at, from));
  if (to) conditions.push(lte(reservations.created_at, to));

  const where = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(reservations).where(where),
    db
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
      .where(where)
      .orderBy(
        desc(reservations.entry_type),
        asc(timeSlots.start_time),
        asc(reservations.queue_position)
      )
      .limit(limit)
      .offset(offset),
  ]);

  return {
    rows: rows as Entry[],
    total: countRows[0]?.count ?? 0,
    page,
    per_page: limit,
  };
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
    client_confirmed: boolean;
    cancellation_reason: string | null;
    penalty_amount: string | null;
    stripe_payment_id: string | null;
    stripe_refund_id: string | null;
    updated_at: Date;
  }>,
  tx?: DbTransaction
): Promise<Entry> {
  const client = tx ?? db;
  const payload = { ...data, updated_at: data.updated_at ?? new Date() };
  const [row] = await client
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
  delta: number,
  tx?: DbTransaction
): Promise<void> {
  if (delta === 0) return;
  const client = tx ?? db;
  await client
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
 * Lists confirmed reservations whose slot start_time + late_tolerance is in the past
 * and client has not confirmed presence. Used by cron to downgrade them to queue.
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
      stripe_refund_id: reservations.stripe_refund_id,
      client_confirmed: reservations.client_confirmed,
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
        eq(reservations.status, 'confirmed'),
        eq(reservations.client_confirmed, false),
        sql`(${timeSlots.start_time} + (${stationConfigs.late_tolerance_minutes} * interval '1 minute')) < ${now}`
      )
    );
  return rows as Entry[];
}

/**
 * Lists confirmed reservations whose slot start_time falls within a time window
 * centered windowMinutes from now, within ±toleranceMinutes.
 * Used by reminder cron to send push notifications (5h and 30min before service).
 */
export async function listReservationsForReminder(
  windowMinutes: number,
  toleranceMinutes: number
): Promise<Entry[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() + (windowMinutes - toleranceMinutes) * 60_000);
  const windowEnd = new Date(now.getTime() + (windowMinutes + toleranceMinutes) * 60_000);
  const rows = await db
    .select()
    .from(reservations)
    .innerJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .where(
      and(
        eq(reservations.entry_type, 'reservation'),
        eq(reservations.status, 'confirmed'),
        eq(reservations.client_confirmed, false),
        gte(timeSlots.start_time, windowStart),
        lte(timeSlots.start_time, windowEnd)
      )
    );
  return rows.map((r) => r.reservations);
}
