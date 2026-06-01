/**
 * Data access for time_slots. Create, delete, and count reservations per slot.
 */
import { eq, and, ne, gt, gte, lt, sql, inArray } from "drizzle-orm";
import { db, type DbTransaction } from "@/lib/db";
import { timeSlots } from "@/lib/db/schema";
import { reservations } from "@/lib/db/schema";

export type TimeSlot = typeof timeSlots.$inferSelect;
export type TimeSlotInsert = typeof timeSlots.$inferInsert;

const SLOT_STATUS_AVAILABLE = "available";

/**
 * Inserts a single time slot. Caller must set station_id, start_time, end_time, capacity.
 */
export async function createSlot(
  stationId: string,
  startTime: Date,
  endTime: Date,
  capacity: number,
): Promise<TimeSlot> {
  const [row] = await db
    .insert(timeSlots)
    .values({
      station_id: stationId,
      start_time: startTime,
      end_time: endTime,
      capacity,
      booked_count: 0,
      status: SLOT_STATUS_AVAILABLE,
    })
    .returning();
  return row;
}

/**
 * Inserts multiple time slots in one batch.
 */
export async function createSlots(
  stationId: string,
  slots: Array<{ start_time: Date; end_time: Date; capacity: number }>,
  tx?: DbTransaction,
): Promise<TimeSlot[]> {
  if (slots.length === 0) return [];
  const client = tx ?? db;
  const rows = await client
    .insert(timeSlots)
    .values(
      slots.map((s) => ({
        station_id: stationId,
        start_time: s.start_time,
        end_time: s.end_time,
        capacity: s.capacity,
        booked_count: 0,
        status: SLOT_STATUS_AVAILABLE,
      })),
    )
    .returning();
  return rows;
}

/**
 * Returns the time slot by id, or undefined.
 */
export async function findSlotById(
  slotId: string,
): Promise<TimeSlot | undefined> {
  return db.query.timeSlots.findFirst({
    where: eq(timeSlots.id, slotId),
  });
}

/**
 * Returns the slot only if it belongs to the given station.
 */
export async function findSlotByIdAndStation(
  slotId: string,
  stationId: string,
): Promise<TimeSlot | undefined> {
  return db.query.timeSlots.findFirst({
    where: and(eq(timeSlots.id, slotId), eq(timeSlots.station_id, stationId)),
  });
}

/**
 * Counts active (non-cancelled) reservations that reference this time_slot_id.
 */
export async function countReservationsBySlotId(
  slotId: string,
  tx?: DbTransaction,
): Promise<number> {
  const client = tx ?? db;
  const result = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(
      and(
        eq(reservations.time_slot_id, slotId),
        ne(reservations.status, "cancelled"),
      ),
    );
  return result[0]?.count ?? 0;
}

/**
 * Counts ALL reservations for a slot (including cancelled).
 * Used before deletion to preserve history — onDelete cascade would wipe
 * cancelled records that appear in client history.
 */
export async function countAllReservationsBySlotId(
  slotId: string,
  tx?: DbTransaction,
): Promise<number> {
  const client = tx ?? db;
  const result = await client
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(eq(reservations.time_slot_id, slotId));
  return result[0]?.count ?? 0;
}

/**
 * Locks a time slot row using SELECT FOR UPDATE within a transaction.
 * Returns the locked row or undefined if not found.
 */
export async function lockSlotForUpdate(
  slotId: string,
  stationId: string,
  tx: DbTransaction,
): Promise<TimeSlot | undefined> {
  const rows = await tx
    .select()
    .from(timeSlots)
    .where(and(eq(timeSlots.id, slotId), eq(timeSlots.station_id, stationId)))
    .for("update");
  return rows[0];
}

/**
 * Deletes the slot by id. Caller must ensure slot belongs to station and has no reservations.
 */
export async function deleteSlotById(slotId: string, tx?: DbTransaction): Promise<void> {
  const client = tx ?? db;
  await client.delete(timeSlots).where(eq(timeSlots.id, slotId));
}

/**
 * Deletes multiple slots by id in one statement. Caller must validate ownership + no reservations.
 */
export async function deleteSlotsByIds(slotIds: string[], tx?: DbTransaction): Promise<void> {
  if (slotIds.length === 0) return;
  const client = tx ?? db;
  await client.delete(timeSlots).where(inArray(timeSlots.id, slotIds));
}

/**
 * Updates the status of a slot. Returns the updated row.
 */
export async function updateSlotStatus(
  slotId: string,
  status: string
): Promise<TimeSlot> {
  const [row] = await db
    .update(timeSlots)
    .set({ status })
    .where(eq(timeSlots.id, slotId))
    .returning();
  if (!row) throw new Error('Update slot status failed');
  return row;
}

/**
 * Increments booked_count for the slot by 1. Used when creating a reservation for the slot.
 */
export async function incrementSlotBookedCount(
  slotId: string,
  tx?: DbTransaction,
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(timeSlots)
    .set({
      booked_count: sql`${timeSlots.booked_count} + 1`,
    })
    .where(eq(timeSlots.id, slotId));
}

/**
 * Decrements booked_count for the slot by 1. Used when cancelling or moving a reservation to queue.
 */
export async function decrementSlotBookedCount(
  slotId: string,
  tx?: DbTransaction,
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(timeSlots)
    .set({
      booked_count: sql`GREATEST(0, ${timeSlots.booked_count} - 1)`,
    })
    .where(eq(timeSlots.id, slotId));
}

/**
 * Lists all slots for a station on a specific date (YYYY-MM-DD), ordered by start_time ascending.
 * Uses an explicit UTC midnight range so the composite index (station_id, start_time) is used
 * as a sargable range scan instead of a function-based filter.
 */
export async function listSlotsByStationAndDate(
  stationId: string,
  dateStr: string,
): Promise<TimeSlot[]> {
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const startOfNextDay = new Date(startOfDay);
  startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1);

  return db
    .select()
    .from(timeSlots)
    .where(
      and(
        eq(timeSlots.station_id, stationId),
        gte(timeSlots.start_time, startOfDay),
        lt(timeSlots.start_time, startOfNextDay),
      ),
    )
    .orderBy(timeSlots.start_time);
}

/**
 * Extends the end_time of a single slot by extraMinutes. Used when the current service overruns.
 * Returns the updated slot.
 */
export async function extendSlotEndTime(
  slotId: string,
  extraMinutes: number,
  tx?: DbTransaction,
): Promise<TimeSlot> {
  const client = tx ?? db;
  const [row] = await client
    .update(timeSlots)
    .set({
      end_time: sql`${timeSlots.end_time} + (${extraMinutes} * interval '1 minute')`,
    })
    .where(eq(timeSlots.id, slotId))
    .returning();
  if (!row) throw new Error(`Slot ${slotId} not found during end_time extension`);
  return row;
}

/**
 * Shifts start_time and end_time of all slots that begin strictly after afterStartTime,
 * on the same day and station, by extraMinutes. Used for cascade delay after an overrun.
 * Returns all updated slots.
 */
export async function shiftSubsequentSlots(
  stationId: string,
  afterStartTime: Date,
  extraMinutes: number,
  tx?: DbTransaction,
): Promise<TimeSlot[]> {
  const client = tx ?? db;
  // Derive the UTC day boundaries from afterStartTime so the composite index
  // (station_id, start_time) is used as a sargable range scan.
  const dateStr = afterStartTime.toISOString().slice(0, 10);
  const startOfNextDay = new Date(`${dateStr}T00:00:00.000Z`);
  startOfNextDay.setUTCDate(startOfNextDay.getUTCDate() + 1);

  return client
    .update(timeSlots)
    .set({
      start_time: sql`${timeSlots.start_time} + (${extraMinutes} * interval '1 minute')`,
      end_time: sql`${timeSlots.end_time} + (${extraMinutes} * interval '1 minute')`,
    })
    .where(
      and(
        eq(timeSlots.station_id, stationId),
        gt(timeSlots.start_time, afterStartTime),
        lt(timeSlots.start_time, startOfNextDay),
      ),
    )
    .returning();
}

/**
 * Returns slots matching the given list of ids.
 * Pass `tx` to run inside an existing transaction (required for TOCTOU-safe ownership checks).
 */
export async function findSlotsByIds(slotIds: string[], tx?: DbTransaction): Promise<TimeSlot[]> {
  if (slotIds.length === 0) return [];
  const client = tx ?? db;
  return client.select().from(timeSlots).where(inArray(timeSlots.id, slotIds));
}
