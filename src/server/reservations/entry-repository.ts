/**
 * Data access for station entries (reservations and queue) in the single reservations table.
 * Enforces entry_type constraints: reservation => time_slot_id set; queue => queue_position set.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from 'drizzle-orm';
import { db, type DbTransaction } from '@/lib/db';
import { reservations, timeSlots, stationConfigs, stations, vehicleFormats, users, stationServices } from '@/lib/db/schema';

export type Entry = typeof reservations.$inferSelect;
export type EntryInsert = typeof reservations.$inferInsert;

/**
 * Shared column projection for all queries that return a full Entry row.
 * Keeps the column list in one place so additions to the schema only need one edit.
 */
const RESERVATION_COLUMNS = {
  id: reservations.id,
  user_id: reservations.user_id,
  entry_type: reservations.entry_type,
  booking_source: reservations.booking_source,
  time_slot_id: reservations.time_slot_id,
  station_id: reservations.station_id,
  vehicle_format_id: reservations.vehicle_format_id,
  service_id: reservations.service_id,
  post_id: reservations.post_id,
  status: reservations.status,
  queue_position: reservations.queue_position,
  ticket_code: reservations.ticket_code,
  amount_paid: reservations.amount_paid,
  commission_rate: reservations.commission_rate,
  commission_amount: reservations.commission_amount,
  station_payout: reservations.station_payout,
  tip_amount: reservations.tip_amount,
  stripe_payment_id: reservations.stripe_payment_id,
  stripe_charge_id: reservations.stripe_charge_id,
  stripe_transfer_id: reservations.stripe_transfer_id,
  stripe_refund_id: reservations.stripe_refund_id,
  stripe_payment_succeeded_at: reservations.stripe_payment_succeeded_at,
  stripe_payment_succeeded_notified_at: reservations.stripe_payment_succeeded_notified_at,
  client_confirmed: reservations.client_confirmed,
  cancellation_reason: reservations.cancellation_reason,
  penalty_amount: reservations.penalty_amount,
  pi_cancel_failed_at: reservations.pi_cancel_failed_at,
  refund_persist_failed_at: reservations.refund_persist_failed_at,
  confirmed_at: reservations.confirmed_at,
  completed_at: reservations.completed_at,
  walk_in_client_email: reservations.walk_in_client_email,
  walk_in_client_name: reservations.walk_in_client_name,
  walk_in_receipt_sent_at: reservations.walk_in_receipt_sent_at,
  created_at: reservations.created_at,
  updated_at: reservations.updated_at,
} as const;

/** Payload for creating a reservation entry: time_slot_id required. */
export type CreateReservationEntryData = {
  user_id: string;
  station_id: string;
  vehicle_format_id?: string | null;
  service_id?: string | null;
  post_id?: string | null;
  time_slot_id: string;
  booking_source?: 'standard' | 'qr';
  status: string;
  amount_paid: string;
  commission_rate: string;
  commission_amount?: string;
  station_payout?: string;
  stripe_payment_id?: string | null;
  ticket_code?: string | null;
  walk_in_client_email?: string | null;
  walk_in_client_name?: string | null;
};

/** Payload for creating a queue entry: queue_position required. */
export type CreateQueueEntryData = {
  user_id: string;
  station_id: string;
  vehicle_format_id?: string | null;
  service_id?: string | null;
  queue_position: number;
  status: string;
  amount_paid: string;
  commission_rate: string;
  commission_amount?: string;
  station_payout?: string;
  stripe_payment_id?: string | null;
  ticket_code?: string | null;
  walk_in_client_email?: string | null;
  walk_in_client_name?: string | null;
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
      service_id: data.service_id ?? null,
      post_id: data.post_id ?? null,
      entry_type: 'reservation',
      booking_source: data.booking_source ?? 'standard',
      time_slot_id: data.time_slot_id,
      queue_position: null,
      status: data.status,
      amount_paid: data.amount_paid,
      commission_rate: data.commission_rate,
      commission_amount: data.commission_amount ?? '0.00',
      station_payout: data.station_payout ?? '0.00',
      stripe_payment_id: data.stripe_payment_id ?? null,
      ticket_code: data.ticket_code ?? null,
      walk_in_client_email: data.walk_in_client_email ?? null,
      walk_in_client_name: data.walk_in_client_name ?? null,
    })
    .returning();
  if (!row) throw new Error('Insert reservation entry failed');
  return row;
}

/**
 * Creates a queue entry. Caller must ensure queue_position is the next available (e.g. end of queue).
 */
export async function createQueueEntry(data: CreateQueueEntryData, tx?: DbTransaction): Promise<Entry> {
  const client = tx ?? db;
  const [row] = await client
    .insert(reservations)
    .values({
      user_id: data.user_id,
      station_id: data.station_id,
      vehicle_format_id: data.vehicle_format_id,
      service_id: data.service_id ?? null,
      entry_type: 'queue',
      booking_source: 'standard',
      time_slot_id: null,
      queue_position: data.queue_position,
      status: data.status,
      amount_paid: data.amount_paid,
      commission_rate: data.commission_rate,
      commission_amount: data.commission_amount ?? '0.00',
      station_payout: data.station_payout ?? '0.00',
      stripe_payment_id: data.stripe_payment_id ?? null,
      ticket_code: data.ticket_code ?? null,
      walk_in_client_email: data.walk_in_client_email ?? null,
      walk_in_client_name: data.walk_in_client_name ?? null,
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
    .select({ ...RESERVATION_COLUMNS, slotStartTime: timeSlots.start_time })
    .from(reservations)
    .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .where(and(eq(reservations.id, id), eq(reservations.user_id, userId)))
    .limit(1);
  return rows[0];
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
 * Lists entries for a station: reservations (by time_slot start_time) then queue (by queue_position).
 * Backward-compatible pagination - defaults to perPage=500 when not provided.
 */
export async function listEntriesByStation(
  stationId: string,
  page = 1,
  perPage = 500
): Promise<Entry[]> {
  const limit = Math.min(Math.max(1, Math.floor(perPage)), 500);
  const offset = (Math.max(1, Math.floor(page)) - 1) * limit;
  return db
    .select(RESERVATION_COLUMNS)
    .from(reservations)
    .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    .where(eq(reservations.station_id, stationId))
    .orderBy(
      entryTypePrimaryOrder(),
      asc(timeSlots.start_time),
      asc(reservations.queue_position)
    )
    .limit(limit)
    .offset(offset);
}

/**
 * Returns active queue entries across all stations (pending, confirmed, late) created within
 * the last 2 days. The 2-day window safely covers stations with very late closing times while
 * excluding genuinely stale entries from previous days.
 *
 * Bounded by `limit` (default 500) so a cron pass over a growing platform cannot exhaust
 * memory or Stripe API quotas in a single iteration (bug #16). Callers that need to drain
 * the full set should paginate via `offset`.
 */
export async function listActiveQueueEntries(
  limit = 500,
  offset = 0
): Promise<Entry[]> {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  return db.query.reservations.findMany({
    where: and(
      eq(reservations.entry_type, 'queue'),
      inArray(reservations.status, ['pending', 'confirmed', 'late']),
      gte(reservations.created_at, twoDaysAgo)
    ),
    orderBy: (r, { asc }) => [asc(r.created_at)],
    limit,
    offset,
  });
}

/** Active statuses for a live queue entry (excludes cancelled, completed, in_progress). */
const QUEUE_LIVE_STATUSES = ['pending_payment', 'pending', 'confirmed', 'late'] as const;

/**
 * Stable primary ordering for entry lists: reservations first, queue second, then any future
 * entry_type alphabetically afterwards. Replaces `desc(reservations.entry_type)` which happened
 * to put 'reservation' before 'queue' by lexicographic chance and would break if a third
 * entry_type were ever added (bug #27).
 */
function entryTypePrimaryOrder() {
  return sql`CASE ${reservations.entry_type} WHEN 'reservation' THEN 0 WHEN 'queue' THEN 1 ELSE 2 END`;
}

/**
 * Lists live queue entries for a station, ordered by queue_position.
 * Only returns entries in an active state (pending_payment, pending, confirmed, late).
 * Cancelled and completed entries are excluded so the queue view is not polluted.
 */
export async function listQueueByStation(stationId: string): Promise<Entry[]> {
  return db.query.reservations.findMany({
    where: and(
      eq(reservations.station_id, stationId),
      eq(reservations.entry_type, 'queue'),
      inArray(reservations.status, [...QUEUE_LIVE_STATUSES])
    ),
    orderBy: asc(reservations.queue_position),
  });
}

/**
 * Returns the count of live queue entries for the station (for queue-position helper context).
 * Only counts active entries (pending_payment, pending, confirmed, late) so cancelled entries
 * do not inflate the count used for position calculation.
 */
export async function countQueueByStation(stationId: string, tx?: DbTransaction): Promise<number> {
  const client = tx ?? db;
  const result = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(
      and(
        eq(reservations.station_id, stationId),
        eq(reservations.entry_type, 'queue'),
        inArray(reservations.status, [...QUEUE_LIVE_STATUSES])
      )
    );
  return result[0]?.count ?? 0;
}

/**
 * Returns the next available queue_position for the station (max + 1, or 1 if empty).
 * Only considers live entries (pending_payment, pending, confirmed, late) so that cancelled
 * entries with a stale non-null queue_position do not inflate the next position number.
 * Accepts an optional transaction so the read is consistent with surrounding writes.
 */
export async function getNextQueuePosition(stationId: string, tx?: DbTransaction): Promise<number> {
  const client = tx ?? db;
  const result = await client
    .select({
      max: sql<number | null>`max(${reservations.queue_position})::int`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.station_id, stationId),
        eq(reservations.entry_type, 'queue'),
        inArray(reservations.status, [...QUEUE_LIVE_STATUSES])
      )
    );
  const max = result[0]?.max ?? 0;
  return max + 1;
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

/** Non-terminal statuses considered "active" for duplicate checks. */
const ACTIVE_STATUSES = ['pending_payment', 'pending', 'confirmed', 'in_progress'];

/**
 * Returns true if the user already has an active queue entry (entry_type='queue') at this station.
 * Does NOT check slot reservations — users may hold multiple reservations at the same station
 * for different time slots.
 */
export async function hasActiveQueueEntryAtStation(
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
        eq(reservations.entry_type, 'queue'),
        inArray(reservations.status, ACTIVE_STATUSES)
      )
    )
    .limit(1);
  return row.length > 0;
}

/**
 * Returns true if the user already has a confirmed/in-progress/pending reservation for this slot.
 * Excludes `pending_payment` — those are handled by the upsert logic in createReservation.
 */
export async function hasActiveReservationForSlot(
  userId: string,
  timeSlotId: string,
  tx?: DbTransaction
): Promise<boolean> {
  const client = tx ?? db;
  const row = await client
    .select({ id: reservations.id })
    .from(reservations)
    .where(
      and(
        eq(reservations.user_id, userId),
        eq(reservations.time_slot_id, timeSlotId),
        eq(reservations.entry_type, 'reservation'),
        inArray(reservations.status, ['pending', 'confirmed', 'in_progress'])
      )
    )
    .limit(1);
  return row.length > 0;
}

/**
 * Finds an existing pending_payment reservation entry for a specific user and time slot.
 * Used in createReservation to cancel stale payment attempts before issuing a new PI.
 */
export async function findPendingPaymentReservationForSlot(
  userId: string,
  timeSlotId: string
): Promise<{ id: string; stripe_payment_id: string | null } | undefined> {
  const row = await db
    .select({ id: reservations.id, stripe_payment_id: reservations.stripe_payment_id })
    .from(reservations)
    .where(
      and(
        eq(reservations.user_id, userId),
        eq(reservations.time_slot_id, timeSlotId),
        eq(reservations.entry_type, 'reservation'),
        eq(reservations.status, 'pending_payment')
      )
    )
    .limit(1);
  return row[0];
}

/**
 * Finds an existing pending_payment queue entry for a specific user at a station.
 * Used in joinQueue to cancel stale payment attempts before issuing a new PI.
 */
export async function findPendingPaymentQueueEntryAtStation(
  userId: string,
  stationId: string
): Promise<{ id: string; stripe_payment_id: string | null; queue_position: number | null } | undefined> {
  const row = await db
    .select({
      id: reservations.id,
      stripe_payment_id: reservations.stripe_payment_id,
      queue_position: reservations.queue_position,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.user_id, userId),
        eq(reservations.station_id, stationId),
        eq(reservations.entry_type, 'queue'),
        eq(reservations.status, 'pending_payment')
      )
    )
    .limit(1);
  return row[0];
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

export {
  setStripeTransferIdIfMissing,
  setStripePaymentSucceededAtIfMissing,
  setStripePaymentSucceededNotifiedAtIfMissing,
  clearStripePaymentSucceededNotifiedAt,
  markPiCancelFailed,
  clearPiCancelFailed,
  markRefundPersistFailed,
  clearRefundPersistFailed,
} from './entry-stripe-repository';

/** Pagination + filter options for entry listing. */
export type ListEntriesFilters = {
  status?: string;
  from?: Date;
  to?: Date;
  /** Filter by time_slot.start_time >= slot_from (reservation entries). */
  slot_from?: Date;
  /** Filter by time_slot.start_time < slot_to (reservation entries). */
  slot_to?: Date;
  entry_type?: 'reservation' | 'queue';
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
      .select(RESERVATION_COLUMNS)
      .from(reservations)
      .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
      .where(where)
      .orderBy(
        entryTypePrimaryOrder(),
        asc(timeSlots.start_time),
        asc(reservations.queue_position)
      )
      .limit(limit)
      .offset(offset),
  ]);

  return {
    rows,
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
    booking_source: 'standard' | 'qr';
    post_id: string | null;
    time_slot_id: string | null;
    queue_position: number | null;
    amount_paid: string;
    commission_rate: string;
    commission_amount: string;
    station_payout: string;
    confirmed_at: Date | null;
    completed_at: Date | null;
    client_confirmed: boolean;
    cancellation_reason: string | null;
    penalty_amount: string | null;
    stripe_payment_id: string | null;
    stripe_charge_id: string | null;
    stripe_refund_id: string | null;
    walk_in_receipt_sent_at: Date | null;
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
 * Updates entry to confirmed only if current status is pending_payment.
 * Returns the updated entry, or undefined if no row matched (race: already cancelled/confirmed).
 */
export async function confirmEntryIfPendingPayment(id: string): Promise<Entry | undefined> {
  const [row] = await db
    .update(reservations)
    .set({
      status: 'confirmed',
      confirmed_at: new Date(),
      updated_at: new Date(),
    })
    .where(and(eq(reservations.id, id), eq(reservations.status, 'pending_payment')))
    .returning();
  return row;
}

/**
 * Cancels an orphaned queue entry only if it is still in 'pending_payment' status with no
 * stripe_payment_id set. Returns the updated row if the guard matched; otherwise undefined.
 *
 * The double guard (status AND stripe_payment_id IS NULL) prevents a race between the cron
 * and a late-arriving Stripe PaymentIntent: if the walk-in flow has already set a Stripe ID
 * (or the webhook has already confirmed the entry) the row will not match and the entry is
 * left untouched.
 */
export async function cancelOrphanedEntryIfEligible(
  id: string,
  tx: DbTransaction
): Promise<Entry | undefined> {
  const [row] = await tx
    .update(reservations)
    .set({
      status: 'cancelled',
      cancellation_reason: 'Payment setup timeout',
      updated_at: new Date(),
    })
    .where(
      and(
        eq(reservations.id, id),
        eq(reservations.status, 'pending_payment'),
        isNull(reservations.stripe_payment_id)
      )
    )
    .returning();
  return row;
}

/** Active statuses a queue entry can be in when detected as a no-show. */
const NO_SHOW_ELIGIBLE_STATUSES = ['pending', 'confirmed', 'late'] as const;

/**
 * Conditionally cancels a queue entry as a no-show only if it is still in an active status.
 * Returns the updated row when the guard matched; otherwise undefined. Using a conditional
 * update here prevents overlapping cron runs from each issuing the Stripe capture/refund/penalty
 * cascade on the same entry - the second run sees the row already at status='cancelled' and skips.
 */
export async function cancelQueueEntryForNoShowIfEligible(
  id: string,
  penaltyAmount: string | null,
  tx?: DbTransaction
): Promise<Entry | undefined> {
  const client = tx ?? db;
  const [row] = await client
    .update(reservations)
    .set({
      status: 'cancelled',
      cancellation_reason: 'no_show',
      penalty_amount: penaltyAmount,
      queue_position: null,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(reservations.id, id),
        eq(reservations.entry_type, 'queue'),
        inArray(reservations.status, [...NO_SHOW_ELIGIBLE_STATUSES])
      )
    )
    .returning();
  return row;
}

/**
 * Only `pending_payment` entries may be cancelled by Stripe failure webhooks.
 *
 * `confirmed` is intentionally excluded: a `confirmed` entry means the card has
 * already been authorized via `amount_capturable_updated`. A late `payment_failed`
 * Stripe retry (3DS timeout, network glitch) must NOT override an authorization
 * that already succeeded — doing so would cancel a reservation for a client whose
 * card is legitimately held, causing them to show up at the station with no slot.
 */
const STRIPE_PAYMENT_CANCEL_STATUSES = ['pending_payment'] as const;

/**
 * Cancels an entry for Stripe payment_failed / canceled webhooks only while status is still
 * pending_payment. Returns the updated row if a row matched; otherwise undefined.
 * Callers must run slot decrement in the same transaction so webhook replays cannot double-decrement.
 */
export async function cancelEntryForStripePaymentFailureIfEligible(
  id: string,
  reason: string,
  tx: DbTransaction
): Promise<Entry | undefined> {
  const [row] = await tx
    .update(reservations)
    .set({
      status: 'cancelled',
      cancellation_reason: reason,
      updated_at: new Date(),
    })
    .where(
      and(eq(reservations.id, id), inArray(reservations.status, [...STRIPE_PAYMENT_CANCEL_STATUSES]))
    )
    .returning();
  return row;
}

/**
 * Atomically moves a queue entry to a new position, shifting neighbors to fill the gap.
 * Safe to call within or outside a transaction.
 */
export async function repositionQueueEntry(
  entryId: string,
  stationId: string,
  oldPos: number,
  newPos: number,
  tx?: DbTransaction
): Promise<void> {
  if (oldPos === newPos) return;
  const client = tx ?? db;

  if (newPos < oldPos) {
    // Moving forward: shift entries in [newPos, oldPos) down by 1 to make room
    await client
      .update(reservations)
      .set({ queue_position: sql`${reservations.queue_position} + 1`, updated_at: new Date() })
      .where(
        and(
          eq(reservations.station_id, stationId),
          eq(reservations.entry_type, 'queue'),
          sql`${reservations.queue_position} >= ${newPos}`,
          sql`${reservations.queue_position} < ${oldPos}`,
          sql`${reservations.id} != ${entryId}`
        )
      );
  } else {
    // Moving backward: shift entries in (oldPos, newPos] up by 1 to fill the gap
    await client
      .update(reservations)
      .set({ queue_position: sql`${reservations.queue_position} - 1`, updated_at: new Date() })
      .where(
        and(
          eq(reservations.station_id, stationId),
          eq(reservations.entry_type, 'queue'),
          sql`${reservations.queue_position} > ${oldPos}`,
          sql`${reservations.queue_position} <= ${newPos}`,
          sql`${reservations.id} != ${entryId}`
        )
      );
  }

  await client
    .update(reservations)
    .set({ queue_position: newPos, updated_at: new Date() })
    .where(eq(reservations.id, entryId));
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
  return db
    .select(RESERVATION_COLUMNS)
    .from(reservations)
    .innerJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
    // `station_configs.id` is the station id (row is 1:1 with `stations`); the table has no `station_id` column.
    .innerJoin(stationConfigs, eq(reservations.station_id, stationConfigs.id))
    .where(
      and(
        eq(reservations.entry_type, 'reservation'),
        eq(reservations.status, 'confirmed'),
        eq(reservations.client_confirmed, false),
        sql`(${timeSlots.start_time} + (${stationConfigs.late_tolerance_minutes} * interval '1 minute')) < ${now}`
      )
    );
}

/**
 * Returns the first active queue entry (lowest queue_position) for a station.
 * Active statuses for queue pickup: pending, confirmed, late.
 * Used by POST /station/queue/next to automatically pick the next client in line.
 */
export async function findFirstActiveQueueEntry(
  stationId: string,
  tx?: DbTransaction
): Promise<Entry | undefined> {
  const client = tx ?? db;
  return client.query.reservations.findFirst({
    where: and(
      eq(reservations.station_id, stationId),
      eq(reservations.entry_type, 'queue'),
      inArray(reservations.status, ['pending', 'confirmed', 'late'])
    ),
    orderBy: asc(reservations.queue_position),
  });
}

/**
 * Returns all active (confirmed or pending_payment) reservations linked to the given slot IDs.
 * Used to identify clients impacted by a cascade time shift after an overrun.
 */
export async function findActiveReservationsBySlotIds(slotIds: string[]): Promise<Entry[]> {
  if (slotIds.length === 0) return [];
  return db.query.reservations.findMany({
    where: and(
      inArray(reservations.time_slot_id, slotIds),
      inArray(reservations.status, ['confirmed', 'pending_payment', 'in_progress'])
    ),
  });
}

/**
 * Returns queue entries with status 'pending_payment', no stripe_payment_id, and created_at
 * older than olderThanMinutes minutes. Used by orphan cleanup cron to find stuck entries
 * where the server crashed after the DB insert but before the Stripe PaymentIntent was created.
 */
export async function findOrphanedPendingPaymentEntries(olderThanMinutes: number): Promise<Entry[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  return db.query.reservations.findMany({
    where: and(
      eq(reservations.status, 'pending_payment'),
      isNull(reservations.stripe_payment_id),
      eq(reservations.entry_type, 'queue'),
      lt(reservations.created_at, cutoff)
    ),
  });
}

/**
 * Returns entries stuck in pending_payment WITH a stripe_payment_id but older than
 * olderThanMinutes — these are entries where the Stripe authorization happened but
 * the `amount_capturable_updated` webhook never arrived (Stripe outage, bad URL,
 * missing STRIPE_WEBHOOK_SECRET). The cron polls Stripe directly for these.
 */
export async function findStalledPendingPaymentEntries(olderThanMinutes: number): Promise<Entry[]> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
  return db.query.reservations.findMany({
    where: and(
      eq(reservations.status, 'pending_payment'),
      isNotNull(reservations.stripe_payment_id),
      lt(reservations.created_at, cutoff)
    ),
    // Limit to avoid hammering Stripe with thousands of retrieve() calls in one run.
    limit: 50,
  });
}

/**
 * Returns reservations whose Stripe-side cancel failed and that still hold a PI to release
 * (bug #12). The reconciliation cron retries cancelPaymentIntent for these rows.
 */
export async function findReservationsNeedingPiCancel(limit = 50): Promise<Entry[]> {
  return db.query.reservations.findMany({
    where: and(
      isNotNull(reservations.pi_cancel_failed_at),
      isNotNull(reservations.stripe_payment_id)
    ),
    limit,
  });
}

/**
 * Returns reservations whose Stripe refund succeeded but whose stripe_refund_id failed to
 * persist (bug #26). The reconciliation cron looks the refund up on Stripe and saves the id.
 */
export async function findReservationsNeedingRefundPersist(limit = 50): Promise<Entry[]> {
  return db.query.reservations.findMany({
    where: and(
      isNotNull(reservations.refund_persist_failed_at),
      isNotNull(reservations.stripe_payment_id),
      isNull(reservations.stripe_refund_id)
    ),
    limit,
  });
}

// %%%%% Rich entry queries - denormalized with station, format, flags %%%%%

/** Denormalized entry shape returned to the client, enriched with joined data. */
export type RichEntry = {
  id: string;
  user_id: string;
  entry_type: 'reservation' | 'queue';
  booking_source: 'standard' | 'qr';
  time_slot_id: string | null;
  station_id: string;
  vehicle_format_id: string;
  status: string;
  queue_position: number | null;
  ticket_code: string | null;
  amount_paid: string;
  created_at: Date;
  updated_at: Date;
  /** Completion timestamp set when the entry transitions to status='completed'. */
  completed_at: Date | null;
  station: {
    id: string;
    name: string;
    address: string;
    city: string;
    latitude: string | null;
    longitude: string | null;
    image_url: string | null;
    free_cancellation_minutes: number | null;
  };
  vehicle_format: { id: string; label: string; price: string } | null;
  service: { id: string; name: string; category: string } | null;
  is_rated: boolean;
  is_tipped: boolean;
  estimated_wait_minutes: number | null;
  /** Reservation slot start (denormalized from time_slots). Null for queue entries. */
  slot_start_time: Date | null;
  /** Reservation slot end (denormalized from time_slots). Null for queue entries. */
  slot_end_time: Date | null;
};

/** Shared SELECT projection for rich entry queries. */
function richEntrySelect() {
  return {
    ...RESERVATION_COLUMNS,
    station_name: stations.name,
    station_address: stations.address,
    station_city: stations.city,
    station_latitude: stations.latitude,
    station_longitude: stations.longitude,
    // station_image_url removed from the main projection: it was a correlated subquery
    // evaluated for every returned row (bug #19). Image URLs are now fetched in a single
    // separate query keyed by distinct station_id and merged in `mapToRichEntry`.
    station_free_cancellation_minutes: stationConfigs.cancellation_delay_minutes,
    station_wash_duration_minutes: stationConfigs.wash_duration_minutes,
    station_wash_post_count: stationConfigs.wash_post_count,
    slot_start_time: timeSlots.start_time,
    slot_end_time: timeSlots.end_time,
    vf_label: vehicleFormats.label,
    vf_price: vehicleFormats.price,
    svc_name: stationServices.name,
    svc_category: stationServices.category,
    is_rated: sql<boolean>`EXISTS (SELECT 1 FROM ratings WHERE ratings.reservation_id = ${reservations.id})`,
    is_tipped: sql<boolean>`EXISTS (SELECT 1 FROM reservation_tips WHERE reservation_tips.reservation_id = ${reservations.id})`,
    // Estimated wait: position × wash_duration / wash_posts (queue entries only).
    estimated_wait_minutes: sql<number | null>`CASE WHEN ${reservations.entry_type} = 'queue' THEN CEIL(COALESCE(${reservations.queue_position}, 0) * COALESCE(${stationConfigs.wash_duration_minutes}, 0)::float / NULLIF(${stationConfigs.wash_post_count}::float, 0)) ELSE NULL END`,
  } as const;
}

/**
 * Fetches the first photo (by position ASC) for each station_id in a single batch query.
 * Replaces the per-row correlated subquery (bug #19) with one round-trip keyed by distinct
 * station ids. Returns a Map for O(1) lookup during row mapping.
 */
async function fetchFirstImagePerStation(
  stationIds: readonly string[]
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(stationIds));
  if (unique.length === 0) return new Map();
  const rows = await db.execute<{ station_id: string; url: string }>(
    sql`SELECT DISTINCT ON (station_id) station_id, url
        FROM station_photos
        WHERE station_id IN (${sql.join(unique.map((id) => sql`${id}`), sql`, `)})
        ORDER BY station_id, position ASC`
  );
  const result = new Map<string, string>();
  for (const row of rows as unknown as Array<{ station_id: string; url: string }>) {
    if (row?.station_id && row?.url) result.set(row.station_id, row.url);
  }
  return result;
}

/** Maps a raw rich-select row to a RichEntry value object. */
function mapToRichEntry(
  r: Record<string, unknown>,
  imageByStation?: Map<string, string>
): RichEntry {
  const stationId = r.station_id as string;
  return {
    id: r.id as string,
    user_id: r.user_id as string,
    entry_type: r.entry_type as 'reservation' | 'queue',
    booking_source: r.booking_source as 'standard' | 'qr',
    time_slot_id: r.time_slot_id as string | null,
    station_id: stationId,
    vehicle_format_id: r.vehicle_format_id as string,
    status: r.status as string,
    queue_position: r.queue_position as number | null,
    ticket_code: r.ticket_code as string | null,
    amount_paid: r.amount_paid as string,
    created_at: r.created_at as Date,
    updated_at: r.updated_at as Date,
    completed_at: (r.completed_at as Date | null) ?? null,
    station: {
      id: stationId,
      name: (r.station_name as string | null) ?? '',
      address: (r.station_address as string | null) ?? '',
      city: (r.station_city as string | null) ?? '',
      latitude: r.station_latitude as string | null,
      longitude: r.station_longitude as string | null,
      image_url: imageByStation?.get(stationId) ?? null,
      free_cancellation_minutes: r.station_free_cancellation_minutes as number | null,
    },
    vehicle_format: r.vf_label
      ? {
          id: r.vehicle_format_id as string,
          label: r.vf_label as string,
          price: r.vf_price as string,
        }
      : null,
    service: r.svc_name
      ? {
          id: r.service_id as string,
          name: r.svc_name as string,
          category: r.svc_category as string,
        }
      : null,
    is_rated: Boolean(r.is_rated),
    is_tipped: Boolean(r.is_tipped),
    estimated_wait_minutes: r.estimated_wait_minutes as number | null,
    slot_start_time: (r.slot_start_time as Date | null) ?? null,
    slot_end_time: (r.slot_end_time as Date | null) ?? null,
  };
}

/**
 * Lists a user's entries enriched with denormalized station, vehicle format, and computed flags.
 * Returns the same pagination shape as listEntriesByUserPaginated.
 */
export async function listRichEntriesByUser(
  userId: string,
  filters: ListEntriesFilters = {}
): Promise<{ rows: RichEntry[]; total: number; page: number; per_page: number }> {
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
    db
      .select(richEntrySelect())
      .from(reservations)
      .leftJoin(stations, eq(stations.id, reservations.station_id))
      .leftJoin(stationConfigs, eq(stationConfigs.id, reservations.station_id))
      .leftJoin(vehicleFormats, eq(vehicleFormats.id, reservations.vehicle_format_id))
      .leftJoin(stationServices, eq(stationServices.id, reservations.service_id))
      .leftJoin(timeSlots, eq(timeSlots.id, reservations.time_slot_id))
      .where(where)
      .orderBy(desc(reservations.created_at))
      .limit(limit)
      .offset(offset),
  ]);

  // Batch-fetch the first image per distinct station (one query) instead of per-row subqueries.
  const imageByStation = await fetchFirstImagePerStation(
    rows.map((r) => (r as { station_id: string }).station_id)
  );

  return {
    rows: rows.map((r) => mapToRichEntry(r as unknown as Record<string, unknown>, imageByStation)),
    total: countRows[0]?.count ?? 0,
    page,
    per_page: limit,
  };
}

/**
 * Returns a single rich entry by id with ownership check (user_id = userId).
 * Returns undefined when not found or owned by another user.
 */
export async function findRichEntryByIdAndUser(
  entryId: string,
  userId: string
): Promise<RichEntry | undefined> {
  const rows = await db
    .select(richEntrySelect())
    .from(reservations)
    .leftJoin(stations, eq(stations.id, reservations.station_id))
    .leftJoin(stationConfigs, eq(stationConfigs.id, reservations.station_id))
    .leftJoin(vehicleFormats, eq(vehicleFormats.id, reservations.vehicle_format_id))
    .leftJoin(stationServices, eq(stationServices.id, reservations.service_id))
    .leftJoin(timeSlots, eq(timeSlots.id, reservations.time_slot_id))
    .where(and(eq(reservations.id, entryId), eq(reservations.user_id, userId)))
    .limit(1);
  if (!rows[0]) return undefined;
  const imageByStation = await fetchFirstImagePerStation([(rows[0] as { station_id: string }).station_id]);
  return mapToRichEntry(rows[0] as unknown as Record<string, unknown>, imageByStation);
}


// %%%%% Rich station entry queries - denormalized with user and vehicle format %%%%%

/** Station-side denormalized entry shape: includes user first_name and vehicle format label. */
export type RichStationEntry = Entry & {
  user_first_name: string | null;
  user_last_name: string | null;
  vehicle_format: { id: string; label: string } | null;
  service: { id: string; name: string; category: string } | null;
  slot_start_time: Date | null;
  slot_end_time: Date | null;
  /* Walk-in client identity, mirrored from the reservations row so the
   * station UI can label the card with the actual merchant-set name
   * (or fall back to the email) instead of a placeholder. */
  walk_in_client_email: string | null;
  walk_in_client_name: string | null;
};

/**
 * Lists entries for a station with pagination and optional filters.
 * Enriched with user first/last name and vehicle_format id/label via LEFT JOINs.
 */
export async function listRichStationEntriesPaginated(
  stationId: string,
  filters: ListEntriesFilters = {}
): Promise<{ rows: RichStationEntry[]; total: number; page: number; per_page: number }> {
  const { status, from, to, slot_from, slot_to, entry_type, page = 1, per_page = 20 } = filters;
  const limit = Math.min(Math.max(1, per_page), 500);
  const offset = (Math.max(1, page) - 1) * limit;

  const conditions = [eq(reservations.station_id, stationId)];
  if (status) conditions.push(eq(reservations.status, status));
  if (entry_type) conditions.push(eq(reservations.entry_type, entry_type));
  if (from) conditions.push(gte(reservations.created_at, from));
  if (to) conditions.push(lte(reservations.created_at, to));
  if (slot_from) conditions.push(gte(timeSlots.start_time, slot_from));
  if (slot_to) conditions.push(lt(timeSlots.start_time, slot_to));
  const where = and(...conditions);

  const [countRows, rows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reservations)
      .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
      .where(where),
    db
      .select({
        ...RESERVATION_COLUMNS,
        user_first_name: users.first_name,
        user_last_name: users.last_name,
        vf_id: vehicleFormats.id,
        vf_label: vehicleFormats.label,
        svc_id: stationServices.id,
        svc_name: stationServices.name,
        svc_category: stationServices.category,
        slot_start_time: timeSlots.start_time,
        slot_end_time: timeSlots.end_time,
      })
      .from(reservations)
      .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
      .leftJoin(users, eq(reservations.user_id, users.id))
      .leftJoin(vehicleFormats, eq(reservations.vehicle_format_id, vehicleFormats.id))
      .leftJoin(stationServices, eq(reservations.service_id, stationServices.id))
      .where(where)
      .orderBy(entryTypePrimaryOrder(), asc(timeSlots.start_time), asc(reservations.queue_position))
      .limit(limit)
      .offset(offset),
  ]);

  const richRows: RichStationEntry[] = rows.map((r) => ({
    ...(r as Entry),
    user_first_name: r.user_first_name,
    user_last_name: r.user_last_name,
    vehicle_format: r.vf_id ? { id: r.vf_id, label: r.vf_label ?? '' } : null,
    service: r.svc_id ? { id: r.svc_id, name: r.svc_name ?? '', category: r.svc_category ?? '' } : null,
    slot_start_time: r.slot_start_time ?? null,
    slot_end_time: r.slot_end_time ?? null,
  }));

  return { rows: richRows, total: countRows[0]?.count ?? 0, page, per_page: limit };
}


// %%%%% END - Rich entry queries %%%%%


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
