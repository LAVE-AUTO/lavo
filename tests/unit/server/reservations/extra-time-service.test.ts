/**
 * Unit tests for extra-time-service: addExtraTime (mocked deps).
 * @jest-environment node
 */
const mockFindEntryByIdAndStation = jest.fn();
const mockFindActiveReservationsBySlotIds = jest.fn();
const mockFindSlotById = jest.fn();
const mockExtendSlotEndTime = jest.fn();
const mockShiftSubsequentSlots = jest.fn();
const mockGetConfigByStationId = jest.fn();
const mockNotifyEntry = jest.fn();

jest.mock('@/server/reservations/entry-repository', () => ({
  findEntryByIdAndStation: (...args: unknown[]) => mockFindEntryByIdAndStation(...args),
  findActiveReservationsBySlotIds: (...args: unknown[]) => mockFindActiveReservationsBySlotIds(...args),
}));
jest.mock('@/server/station/slot-repository', () => ({
  findSlotById: (...args: unknown[]) => mockFindSlotById(...args),
  extendSlotEndTime: (...args: unknown[]) => mockExtendSlotEndTime(...args),
  shiftSubsequentSlots: (...args: unknown[]) => mockShiftSubsequentSlots(...args),
}));
jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));
jest.mock('@/server/notifications/notification-service', () => ({
  notifyEntry: (...args: unknown[]) => mockNotifyEntry(...args),
}));
jest.mock('@/server/notifications/client-feed-notifications', () => ({
  notifyClientFeed: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/helpers/date-helper', () => ({
  parseTimeForDate: jest.fn((dateStr: string, timeStr: string) => new Date(`${dateStr}T${timeStr}Z`)),
}));
jest.mock('@/lib/db', () => ({
  db: {
    transaction: jest.fn(async (cb: (tx: object) => Promise<unknown>) => cb({})),
  },
}));

import { addExtraTime } from '@/server/reservations/extra-time-service';
import { NotFoundError, ConflictError, ValidationError } from '@/lib/errors';

const reservationId = 'entry-1';
const stationId = 'station-1';
const userId = 'user-1';
const slotId = 'slot-1';
const extraMinutes = 15;

const baseEntry = {
  id: reservationId,
  user_id: userId,
  station_id: stationId,
  entry_type: 'reservation' as const,
  status: 'in_progress',
  time_slot_id: slotId,
};

const baseSlot = {
  id: slotId,
  station_id: stationId,
  start_time: new Date('2026-04-17T10:00:00Z'),
  end_time: new Date('2026-04-17T10:30:00Z'),
  capacity: 2,
  booked_count: 1,
};

describe('extra-time-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExtendSlotEndTime.mockResolvedValue(undefined);
    mockShiftSubsequentSlots.mockResolvedValue([]);
    mockGetConfigByStationId.mockResolvedValue(null);
    mockFindActiveReservationsBySlotIds.mockResolvedValue([]);
    mockNotifyEntry.mockResolvedValue(undefined);
  });

  describe('addExtraTime', () => {
    it.each([
      ['zero', 0],
      ['negative', -10],
      ['NaN', Number.NaN],
      ['Infinity', Number.POSITIVE_INFINITY],
      ['non-integer', 1.5],
      ['above ceiling', 10_000],
    ])('throws ValidationError when extraMinutes is %s', async (_label, bad) => {
      await expect(addExtraTime(reservationId, stationId, bad as number)).rejects.toThrow(
        ValidationError
      );
      // Must short-circuit before any DB read.
      expect(mockFindEntryByIdAndStation).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when entry not found', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue(undefined);
      await expect(addExtraTime(reservationId, stationId, extraMinutes)).rejects.toThrow(NotFoundError);
    });

    it('throws ConflictError when entry is not a reservation', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({ ...baseEntry, entry_type: 'queue' });
      await expect(addExtraTime(reservationId, stationId, extraMinutes)).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when status is not in_progress', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({ ...baseEntry, status: 'pending' });
      await expect(addExtraTime(reservationId, stationId, extraMinutes)).rejects.toThrow(ConflictError);
    });

    it('rejects confirmed status - only in_progress is valid', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({ ...baseEntry, status: 'confirmed' });
      await expect(addExtraTime(reservationId, stationId, extraMinutes)).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when no time_slot_id', async () => {
      mockFindEntryByIdAndStation.mockResolvedValue({ ...baseEntry, time_slot_id: null });
      await expect(addExtraTime(reservationId, stationId, extraMinutes)).rejects.toThrow(ConflictError);
    });

    it('happy path: transaction called, slots shifted, notifications sent', async () => {
      const affectedEntry = {
        id: 'entry-2',
        user_id: 'user-2',
        station_id: stationId,
      };
      const shiftedSlot = {
        id: 'slot-2',
        station_id: stationId,
        start_time: new Date('2026-04-17T10:30:00Z'),
        end_time: new Date('2026-04-17T11:00:00Z'),
      };

      mockFindEntryByIdAndStation.mockResolvedValue(baseEntry);
      mockFindSlotById.mockResolvedValue(baseSlot);
      mockShiftSubsequentSlots.mockResolvedValue([shiftedSlot]);
      mockFindActiveReservationsBySlotIds.mockResolvedValue([affectedEntry]);

      const result = await addExtraTime(reservationId, stationId, extraMinutes);

      expect(mockExtendSlotEndTime).toHaveBeenCalledWith(slotId, extraMinutes, expect.anything());
      expect(mockShiftSubsequentSlots).toHaveBeenCalledWith(
        stationId,
        baseSlot.start_time,
        extraMinutes,
        expect.anything()
      );
      expect(mockNotifyEntry).toHaveBeenCalledWith(
        expect.objectContaining({ entryId: affectedEntry.id })
      );
      expect(result.reservation_id).toBe(reservationId);
      expect(result.extra_minutes).toBe(extraMinutes);
      expect(result.shifted_slots).toBe(1);
    });

    it('classifies slots beyond closing time separately from delayed slots', async () => {
      const closingTime = '18:00:00';
      mockGetConfigByStationId.mockResolvedValue({ closing_time: closingTime });

      const delayedSlot = {
        id: 'slot-delayed',
        station_id: stationId,
        start_time: new Date('2026-04-17T10:30:00Z'),
        end_time: new Date('2026-04-17T11:00:00Z'),
      };
      const beyondSlot = {
        id: 'slot-beyond',
        station_id: stationId,
        start_time: new Date('2026-04-17T18:00:00Z'),
        end_time: new Date('2026-04-17T18:30:00Z'),
      };

      mockFindEntryByIdAndStation.mockResolvedValue(baseEntry);
      mockFindSlotById.mockResolvedValue(baseSlot);
      mockShiftSubsequentSlots.mockResolvedValue([delayedSlot, beyondSlot]);

      const delayedReservation = { id: 'entry-delayed', user_id: 'u2', station_id: stationId };
      const beyondReservation = { id: 'entry-beyond', user_id: 'u3', station_id: stationId };

      mockFindActiveReservationsBySlotIds
        .mockResolvedValueOnce([beyondReservation])
        .mockResolvedValueOnce([delayedReservation]);

      const result = await addExtraTime(reservationId, stationId, extraMinutes);

      expect(result.shifted_slots).toBe(2);
      expect(result.notified_beyond_closing).toBe(1);
      expect(result.notified_delayed).toBe(1);

      const beyondCall = mockNotifyEntry.mock.calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'slot_beyond_closing'
      );
      const delayedCall = mockNotifyEntry.mock.calls.find(
        (c: unknown[]) => (c[0] as { type: string }).type === 'extra_time_delay'
      );
      expect(beyondCall).toBeDefined();
      expect(delayedCall).toBeDefined();
    });
  });
});
