/**
 * Slot business logic: generate slots from config, create/delete slots.
 * Used by POST /api/v1/station/slots, bulk, generate, and DELETE.
 */
import { NotFoundError, ConflictError } from '@/lib/errors';
import type { StationConfig } from './config-repository';
import { getConfigByStationId } from './config-repository';
import {
  createSlot as repoCreateSlot,
  createSlots as repoCreateSlots,
  findSlotByIdAndStation,
  countReservationsBySlotId,
  deleteSlotById,
} from './slot-repository';

const DEFAULT_SLOT_INTERVAL_MINUTES = 30;

/**
 * Parses a date string (YYYY-MM-DD) and time string (HH:mm or HH:mm:ss, optional +00) into a Date (UTC).
 */
function toDateAtTime(dateStr: string, timeStr: string): Date {
  let t = timeStr.trim();
  if (t.length === 5) t += ':00';
  if (!t.endsWith('Z') && !t.includes('+')) t += 'Z';
  if (t.endsWith('+00')) t = t.slice(0, -3) + 'Z';
  return new Date(`${dateStr}T${t}`);
}

/**
 * Generates non-overlapping time slots for the given date(s) using station config.
 * Uses opening_time, closing_time, break_start/break_end, interval_minutes, and capacity
 * (max_concurrent_posts or wash_post_count). Excludes the break window.
 */
export function generateSlotsFromConfig(
  config: StationConfig,
  dateStr: string,
  endDateStr?: string,
  intervalMinutes: number = DEFAULT_SLOT_INTERVAL_MINUTES
): Array<{ start_time: Date; end_time: Date; capacity: number }> {
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
    let slotStart = toDateAtTime(dayStr, openTime);
    const dayEnd = toDateAtTime(dayStr, closeTime);
    const dayBreakStart = breakStart ? toDateAtTime(dayStr, breakStart) : null;
    const dayBreakEnd = breakEnd ? toDateAtTime(dayStr, breakEnd) : null;

    while (slotStart < dayEnd) {
      const slotEnd = new Date(slotStart.getTime() + intervalMinutes * 60 * 1000);
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
