/**
 * Dynamic slot availability computation.
 *
 * Slots are pre-generated and stored in time_slots. This service computes the real-time
 * availability for a given station and date, accounting for:
 *   - booked_count vs capacity (actual reservations in each slot)
 *   - slots shifted past station closing_time (cascade overruns that exceeded the day)
 *   - slots in the past (no longer bookable)
 *
 * Used by GET /api/v1/station/slots to return the dynamic schedule.
 */
import { getConfigByStationId } from './config-repository';
import { listSlotsByStationAndDate } from './slot-repository';
import type { TimeSlot } from './slot-repository';

export type SlotAvailability = TimeSlot & {
  available_spots: number;
  is_available: boolean;
  is_past: boolean;
  exceeds_closing_time: boolean;
};

/**
 * Parses a time string (HH:mm or HH:mm:ss, optional +00) and a date string (YYYY-MM-DD)
 * into a UTC Date. Replicates the logic from slot-service to be self-contained.
 */
function toDateAtTime(dateStr: string, timeStr: string): Date {
  let t = timeStr.trim();
  if (t.length === 5) t += ':00';
  if (!t.endsWith('Z') && !t.includes('+')) t += 'Z';
  if (t.endsWith('+00')) t = t.slice(0, -3) + 'Z';
  return new Date(`${dateStr}T${t}`);
}

/**
 * Returns slot availability for a station on the given date.
 *
 * Each slot includes:
 *   - available_spots: remaining capacity (capacity - booked_count), never negative
 *   - is_available: true if available_spots > 0, slot is not in the past, and does not exceed closing_time
 *   - is_past: true if slot start_time is before now
 *   - exceeds_closing_time: true if slot end_time exceeds station closing_time (cascade overrun)
 *
 * @param stationId - Station UUID
 * @param dateStr - Date in YYYY-MM-DD format (defaults to today UTC)
 */
export async function getStationSlotAvailability(
  stationId: string,
  dateStr?: string
): Promise<SlotAvailability[]> {
  const today = new Date().toISOString().slice(0, 10);
  const targetDate = dateStr ?? today;

  const [config, slots] = await Promise.all([
    getConfigByStationId(stationId),
    listSlotsByStationAndDate(stationId, targetDate),
  ]);

  const now = new Date();

  // Compute the station closing time for this date to detect cascade overruns.
  let closingTime: Date | null = null;
  if (config?.closing_time) {
    closingTime = toDateAtTime(targetDate, config.closing_time as string);
  }

  return slots.map((slot) => {
    const available_spots = Math.max(0, slot.capacity - slot.booked_count);
    const is_past = slot.start_time < now;
    const exceeds_closing_time = closingTime !== null && slot.end_time > closingTime;
    const is_available = available_spots > 0 && !is_past && !exceeds_closing_time;

    return {
      ...slot,
      available_spots,
      is_available,
      is_past,
      exceeds_closing_time,
    };
  });
}
