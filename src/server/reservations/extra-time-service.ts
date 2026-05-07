/**
 * Extra time service: handles wash service overruns.
 *
 * When a wash takes longer than the reserved slot, the station can declare extra time.
 * This triggers an atomic cascade:
 *   1. Extend the current reservation's slot end_time.
 *   2. Shift all subsequent slots for the same station and day forward by extraMinutes.
 *   3. Categorise the shifted slots:
 *      - Within closing time → notify impacted clients of the delay (extra_time_delay).
 *      - start_time >= closing_time → the slot is now outside station hours; notify the
 *        client with slot_beyond_closing so they can choose to cancel (full refund) or stay.
 *
 * The DB update is atomic (single transaction). Notifications are sent outside the transaction
 * to avoid holding DB locks during external calls.
 *
 * Station-fault cancellation policy (enforced in cancellation-service):
 *   When a client whose slot exceeds closing time chooses to cancel, the penalty is waived
 *   regardless of how close the cancellation is to the (now-impossible) slot time.
 *
 * Used by POST /api/v1/station/extra-time.
 */
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import { db } from '@/lib/db';
import { parseTimeForDate } from '@/helpers/date-helper';
import { findEntryByIdAndStation, findActiveReservationsBySlotIds } from './entry-repository';
import {
  findSlotById,
  extendSlotEndTime,
  shiftSubsequentSlots,
} from '@/server/station/slot-repository';
import type { TimeSlot } from '@/server/station/slot-repository';
import { getConfigByStationId } from '@/server/station/config-repository';
import { notifyEntry } from '@/server/notifications/notification-service';

type AffectedEntry = { id: string; user_id: string; station_id: string };

/**
 * Upper bound on extra time per request. A single overrun should not exceed a full working day;
 * larger values almost certainly indicate a bug or malicious payload. 480 minutes (8 hours) is
 * a conservative ceiling - higher than any legitimate wash service, lower than the 24h day that
 * would otherwise allow SQL interval math to flip dates or cascade-shift slots off the schedule.
 */
const MAX_EXTRA_MINUTES = 480;

/**
 * Sends a notification to each affected entry concurrently.
 * Returns the number of notifications that were delivered successfully.
 * Individual failures are logged but do not throw.
 */
async function notifyAffected(
  entries: AffectedEntry[],
  type: 'slot_beyond_closing' | 'extra_time_delay',
  extraMinutes: number
): Promise<number> {
  const results = await Promise.allSettled(
    entries.map((affected) =>
      notifyEntry({
        entryId: affected.id,
        userId: affected.user_id,
        stationId: affected.station_id,
        type,
        payload: { extra_minutes: extraMinutes },
      })
    )
  );
  let succeeded = 0;
  for (const result of results) {
    if (result.status === 'fulfilled') {
      succeeded++;
    } else {
      console.error(`[EXTRA_TIME] ${type} notification failed`, result.reason);
    }
  }
  return succeeded;
}

export type ExtraTimeResult = {
  reservation_id: string;
  extra_minutes: number;
  /** Total number of subsequent slots shifted. */
  shifted_slots: number;
  /** Clients notified of a standard delay (slot still within station hours). */
  notified_delayed: number;
  /** Clients notified that their slot now falls outside station closing time. */
  notified_beyond_closing: number;
};

/**
 * Applies extra time to a reservation currently in progress, then cascades
 * the delay to all subsequent slots on the same station day.
 *
 * Only reservations with status 'in_progress' are accepted. A reservation in
 * 'confirmed' status has not started yet - overtime cannot be declared on it.
 *
 * Clients on slots that remain within station hours receive a standard delay notification.
 * Clients on slots that now start at or after closing time receive a station-fault alert
 * and may cancel for a full refund without penalty.
 *
 * @param reservationId - UUID of the reservation that is overrunning
 * @param stationId     - Station UUID (ownership check)
 * @param extraMinutes  - Positive integer: minutes to add
 */
export async function addExtraTime(
  reservationId: string,
  stationId: string,
  extraMinutes: number
): Promise<ExtraTimeResult> {
  // Defensive server-side validation. Callers (route handlers) should validate too, but this
  // service is a sensitive mutation path: negative values would move slots backward in time,
  // non-finite values would corrupt the SQL interval expression, and unbounded values would
  // cascade-shift the rest of the day off-schedule.
  if (
    typeof extraMinutes !== 'number' ||
    !Number.isFinite(extraMinutes) ||
    !Number.isInteger(extraMinutes) ||
    extraMinutes <= 0 ||
    extraMinutes > MAX_EXTRA_MINUTES
  ) {
    throw new ValidationError(
      `extraMinutes must be a positive integer between 1 and ${MAX_EXTRA_MINUTES}`
    );
  }

  const entry = await findEntryByIdAndStation(reservationId, stationId);
  if (!entry) throw new NotFoundError('Reservation not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (entry.status !== 'in_progress') {
    throw new ConflictError(
      `Cannot add extra time to a reservation with status '${entry.status}'`
    );
  }
  if (!entry.time_slot_id) throw new ConflictError('Reservation has no associated time slot');

  const [slot, config] = await Promise.all([
    findSlotById(entry.time_slot_id),
    getConfigByStationId(stationId),
  ]);
  if (!slot) throw new NotFoundError('Time slot not found');

  // Compute the closing-time boundary for the day of this slot.
  // If the station has no config or no closing_time, we treat all slots as within hours.
  const slotDateStr = slot.start_time.toISOString().slice(0, 10);
  const closingTime: Date | null =
    config?.closing_time
      ? parseTimeForDate(slotDateStr, config.closing_time as string)
      : null;

  // Atomic: extend current slot end_time and shift all subsequent slots on the same day.
  let shiftedSlots: TimeSlot[] = [];
  await db.transaction(async (tx) => {
    await extendSlotEndTime(slot.id, extraMinutes, tx);
    shiftedSlots = await shiftSubsequentSlots(stationId, slot.start_time, extraMinutes, tx);
  });

  // Separate shifted slots into two groups based on the closing-time boundary.
  const beyondClosingSlotIds: string[] = [];
  const delayedSlotIds: string[] = [];

  for (const shifted of shiftedSlots) {
    if (closingTime && shifted.start_time >= closingTime) {
      beyondClosingSlotIds.push(shifted.id);
    } else {
      delayedSlotIds.push(shifted.id);
    }
  }

  // Short-circuit empty arrays to avoid unnecessary SQL queries.
  const [beyondClosingReservations, delayedReservations] = await Promise.all([
    beyondClosingSlotIds.length > 0 ? findActiveReservationsBySlotIds(beyondClosingSlotIds) : [],
    delayedSlotIds.length > 0 ? findActiveReservationsBySlotIds(delayedSlotIds) : [],
  ]);

  // Notify clients concurrently; each group runs independently.
  const [notifiedBeyondClosing, notifiedDelayed] = await Promise.all([
    notifyAffected(beyondClosingReservations, 'slot_beyond_closing', extraMinutes),
    notifyAffected(delayedReservations, 'extra_time_delay', extraMinutes),
  ]);

  return {
    reservation_id: reservationId,
    extra_minutes: extraMinutes,
    shifted_slots: shiftedSlots.length,
    notified_delayed: notifiedDelayed,
    notified_beyond_closing: notifiedBeyondClosing,
  };
}
