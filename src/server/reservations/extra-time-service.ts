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
import { NotFoundError, ConflictError } from '@/lib/errors';
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
 * Applies extra time to a reservation currently in progress or confirmed, then cascades
 * the delay to all subsequent slots on the same station day.
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
  const entry = await findEntryByIdAndStation(reservationId, stationId);
  if (!entry) throw new NotFoundError('Reservation not found');
  if (entry.entry_type !== 'reservation') throw new ConflictError('Entry is not a reservation');
  if (!['in_progress', 'confirmed'].includes(entry.status)) {
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

  // Fetch reservations for each group in parallel.
  const [beyondClosingReservations, delayedReservations] = await Promise.all([
    findActiveReservationsBySlotIds(beyondClosingSlotIds),
    findActiveReservationsBySlotIds(delayedSlotIds),
  ]);

  // Notify clients outside closing hours — station-fault alert.
  let notifiedBeyondClosing = 0;
  for (const affected of beyondClosingReservations) {
    try {
      await notifyEntry({
        entryId: affected.id,
        userId: affected.user_id,
        stationId: affected.station_id,
        type: 'slot_beyond_closing',
        payload: { extra_minutes: extraMinutes },
      });
      notifiedBeyondClosing++;
    } catch (e) {
      console.error('[EXTRA_TIME] slot_beyond_closing notification failed for entry', affected.id, e);
    }
  }

  // Notify clients with a standard delay.
  let notifiedDelayed = 0;
  for (const affected of delayedReservations) {
    try {
      await notifyEntry({
        entryId: affected.id,
        userId: affected.user_id,
        stationId: affected.station_id,
        type: 'extra_time_delay',
        payload: { extra_minutes: extraMinutes },
      });
      notifiedDelayed++;
    } catch (e) {
      console.error('[EXTRA_TIME] extra_time_delay notification failed for entry', affected.id, e);
    }
  }

  return {
    reservation_id: reservationId,
    extra_minutes: extraMinutes,
    shifted_slots: shiftedSlots.length,
    notified_delayed: notifiedDelayed,
    notified_beyond_closing: notifiedBeyondClosing,
  };
}
