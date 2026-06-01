/**
 * Slot business logic: generate slots from config, create/delete slots.
 * Used by POST /api/v1/station/slots, bulk, generate, and DELETE.
 */
import { NotFoundError, ConflictError } from '@/lib/errors';
import { parseTimeForDate } from '@/helpers/date-helper';
import { db } from '@/lib/db';
import type { StationConfig } from './config-repository';
import { getConfigByStationId } from './config-repository';
import {
  createSlot as repoCreateSlot,
  createSlots as repoCreateSlots,
  findSlotByIdAndStation,
  findSlotsByIds,
  countReservationsBySlotId,
  countAllReservationsBySlotId,
  deleteSlotById,
  deleteSlotsByIds,
  updateSlotStatus,
  type TimeSlot,
} from './slot-repository';

const DEFAULT_SLOT_INTERVAL_MINUTES = 30;


/**
 * Generates non-overlapping time slots for the given date(s) using station config.
 * Uses opening_time, closing_time, break_start/break_end, interval_minutes, and capacity
 * (max_concurrent_posts or wash_post_count). Excludes the break window.
 *
 * intervalMinutes defaults to config.wash_duration_minutes if not explicitly provided,
 * so generated slots align with the real service duration.
 */
export function generateSlotsFromConfig(
  config: StationConfig,
  dateStr: string,
  endDateStr?: string,
  intervalMinutes?: number
): Array<{ start_time: Date; end_time: Date; capacity: number }> {
  const resolvedInterval =
    intervalMinutes ?? (config.wash_duration_minutes ?? DEFAULT_SLOT_INTERVAL_MINUTES);
  const capacity =
    config.max_concurrent_posts ?? config.wash_post_count ?? 1;
  const slots: Array<{ start_time: Date; end_time: Date; capacity: number }> = [];
  const startDate = new Date(dateStr);
  const endDate = endDateStr ? new Date(endDateStr) : startDate;
  if (endDate < startDate) return slots;

  const openTime = config.opening_time as string;
  const closeTime = config.closing_time as string;
  const breakStart = config.break_start as string | null;
  const breakEnd = config.break_end as string | null;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10);
    let slotStart = parseTimeForDate(dayStr, openTime);
    const dayEnd = parseTimeForDate(dayStr, closeTime);
    const dayBreakStart = breakStart ? parseTimeForDate(dayStr, breakStart) : null;
    const dayBreakEnd = breakEnd ? parseTimeForDate(dayStr, breakEnd) : null;

    while (slotStart < dayEnd) {
      const slotEnd = new Date(slotStart.getTime() + resolvedInterval * 60 * 1000);
      if (slotEnd > dayEnd) break;
      if (dayBreakStart && dayBreakEnd && slotStart < dayBreakEnd && slotEnd > dayBreakStart) {
        slotStart = dayBreakEnd;
        continue;
      }
      slots.push({
        start_time: new Date(slotStart),
        end_time: slotEnd,
        capacity,
      });
      slotStart = slotEnd;
    }
  }
  return slots;
}

/**
 * Loads config for the station and generates slots for the given date (or range).
 * Persists slots via slot-repository. Returns created slots.
 */
export async function generateAndPersistSlots(
  stationId: string,
  dateStr: string,
  endDateStr?: string,
  intervalMinutes?: number
): Promise<Awaited<ReturnType<typeof repoCreateSlots>>> {
  const config = await getConfigByStationId(stationId);
  if (!config) throw new NotFoundError('Station has no config; create config first');
  const list = generateSlotsFromConfig(config, dateStr, endDateStr, intervalMinutes);
  return repoCreateSlots(stationId, list);
}

/**
 * Creates a single slot for the station. Validates start < end and capacity > 0 (caller/validator).
 */
export async function createSlot(
  stationId: string,
  startTime: Date,
  endTime: Date,
  capacity: number
) {
  return repoCreateSlot(stationId, startTime, endTime, capacity);
}

/**
 * Creates multiple slots in one batch.
 */
export async function createSlotsBulk(
  stationId: string,
  slots: Array<{ start_time: Date; end_time: Date; capacity: number }>
) {
  return repoCreateSlots(stationId, slots);
}

/**
 * Deletes a slot by id if it belongs to the station and has no reservations.
 * Throws if slot not found or not owned by station or has reservations.
 */
export async function deleteSlot(stationId: string, slotId: string): Promise<void> {
  const slot = await findSlotByIdAndStation(slotId, stationId);
  if (!slot) throw new NotFoundError('Slot not found or does not belong to this station');
  const count = await countReservationsBySlotId(slotId);
  if (count > 0) throw new ConflictError('Cannot delete slot that has reservations');
  await deleteSlotById(slotId);
}

/**
 * Atomically replaces a set of existing slots with a new set within a single DB transaction.
 * - Slots that don't belong to the station → NotFoundError (hard stop).
 * - Slots with active reservations are skipped from deletion to preserve existing bookings;
 *   the new slots are still created alongside them.
 * - If anything fails, the whole operation is rolled back — no orphan slots.
 */
export async function replaceSlots(
  stationId: string,
  idsToDelete: string[],
  newSlots: Array<{ start_time: Date; end_time: Date; capacity: number }>
): Promise<TimeSlot[]> {
  return db.transaction(async (tx) => {
    if (idsToDelete.length > 0) {
      const existing = await findSlotsByIds(idsToDelete, tx);

      const deletable: string[] = [];
      for (const id of idsToDelete) {
        const slot = existing.find((s) => s.id === id);
        if (!slot || slot.station_id !== stationId) {
          throw new NotFoundError(`Slot ${id} not found or does not belong to this station`);
        }
        // Count ALL reservations (including cancelled) — onDelete cascade would
        // wipe cancelled records that still appear in client history.
        const count = await countAllReservationsBySlotId(id, tx);
        if (count === 0) {
          deletable.push(id);
        }
      }

      if (deletable.length > 0) {
        await deleteSlotsByIds(deletable, tx);
      }
    }

    if (newSlots.length === 0) return [];
    return repoCreateSlots(stationId, newSlots, tx);
  });
}

/**
 * Blocks a slot by setting its status to 'blocked'.
 * Throws ConflictError if the slot has active (confirmed) reservations.
 */
export async function blockSlot(
  stationId: string,
  slotId: string
): Promise<TimeSlot> {
  const slot = await findSlotByIdAndStation(slotId, stationId);
  if (!slot) throw new NotFoundError('Slot not found or does not belong to this station');
  const count = await countReservationsBySlotId(slotId);
  if (count > 0) throw new ConflictError('Cannot block slot that has active reservations');
  return updateSlotStatus(slotId, 'blocked');
}
