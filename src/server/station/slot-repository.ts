/**
 * Data access for time_slots. Create, delete, and count reservations per slot.
 */
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { timeSlots } from '@/lib/db/schema';
import { reservations } from '@/lib/db/schema';

export type TimeSlot = typeof timeSlots.$inferSelect;
export type TimeSlotInsert = typeof timeSlots.$inferInsert;

const SLOT_STATUS_AVAILABLE = 'available';

/**
 * Inserts a single time slot. Caller must set station_id, start_time, end_time, capacity.
 */
export async function createSlot(
  stationId: string,
  startTime: Date,
  endTime: Date,
  capacity: number
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
  slots: Array<{ start_time: Date; end_time: Date; capacity: number }>
): Promise<TimeSlot[]> {
  if (slots.length === 0) return [];
  const rows = await db
    .insert(timeSlots)
    .values(
      slots.map((s) => ({
        station_id: stationId,
        start_time: s.start_time,
        end_time: s.end_time,
        capacity: s.capacity,
        booked_count: 0,
        status: SLOT_STATUS_AVAILABLE,
      }))
    )
    .returning();
  return rows;
}

/**
 * Returns the time slot by id, or undefined.
 */
export async function findSlotById(slotId: string): Promise<TimeSlot | undefined> {
  return db.query.timeSlots.findFirst({
    where: eq(timeSlots.id, slotId),
  });
}

/**
 * Returns the slot only if it belongs to the given station.
 */
export async function findSlotByIdAndStation(
  slotId: string,
  stationId: string
): Promise<TimeSlot | undefined> {
  return db.query.timeSlots.findFirst({
    where: and(eq(timeSlots.id, slotId), eq(timeSlots.station_id, stationId)),
  });
}

/**
 * Counts reservations that reference this time_slot_id (any status).
 */
export async function countReservationsBySlotId(slotId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(eq(reservations.time_slot_id, slotId));
  return result[0]?.count ?? 0;
}

/**
 * Deletes the slot by id. Caller must ensure slot belongs to station and has no reservations.
 */
export async function deleteSlotById(slotId: string): Promise<void> {
  await db.delete(timeSlots).where(eq(timeSlots.id, slotId));
}

/**
 * Increments booked_count for the slot by 1. Used when creating a reservation for the slot.
 */
export async function incrementSlotBookedCount(slotId: string): Promise<void> {
  await db
    .update(timeSlots)
    .set({
      booked_count: sql`${timeSlots.booked_count} + 1`,
      updated_at: new Date(),
    })
    .where(eq(timeSlots.id, slotId));
}

/**
 * Decrements booked_count for the slot by 1. Used when cancelling or moving a reservation to queue.
 */
export async function decrementSlotBookedCount(slotId: string): Promise<void> {
  await db
    .update(timeSlots)
    .set({
      booked_count: sql`GREATEST(0, ${timeSlots.booked_count} - 1)`,
      updated_at: new Date(),
    })
    .where(eq(timeSlots.id, slotId));
}
