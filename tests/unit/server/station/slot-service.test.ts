/**
 * Unit tests for slot-service: generateSlotsFromConfig (pure), deleteSlot (mocked repo).
 */
const mockFindSlotByIdAndStation = jest.fn();
const mockCountReservationsBySlotId = jest.fn();
const mockDeleteSlotById = jest.fn();
const mockCreateSlots = jest.fn();

const mockGetConfigByStationId = jest.fn();
jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));

jest.mock('@/server/station/slot-repository', () => ({
  createSlot: jest.fn(),
  createSlots: (...args: unknown[]) => mockCreateSlots(...args),
  findSlotByIdAndStation: (...args: unknown[]) => mockFindSlotByIdAndStation(...args),
  countReservationsBySlotId: (...args: unknown[]) => mockCountReservationsBySlotId(...args),
  deleteSlotById: (...args: unknown[]) => mockDeleteSlotById(...args),
}));

import { generateSlotsFromConfig, deleteSlot, generateAndPersistSlots } from '@/server/station/slot-service';
import { NotFoundError, ConflictError } from '@/lib/errors';

const config = {
  opening_time: '08:00:00+00',
  closing_time: '12:00:00+00',
  break_start: null as string | null,
  break_end: null as string | null,
  wash_post_count: 2,
  max_concurrent_posts: 2,
} as any;

describe('slot-service', () => {
  describe('generateSlotsFromConfig', () => {
    it('generates non-overlapping slots for one day with 30 min interval', () => {
      const slots = generateSlotsFromConfig(config, '2026-03-07', undefined, 30);
      expect(slots.length).toBe(8);
      expect(slots[0].start_time).toEqual(new Date('2026-03-07T08:00:00.000Z'));
      expect(slots[0].end_time).toEqual(new Date('2026-03-07T08:30:00.000Z'));
      expect(slots[0].capacity).toBe(2);
      expect(slots[7].end_time).toEqual(new Date('2026-03-07T12:00:00.000Z'));
    });

    it('excludes break window', () => {
      const withBreak = {
        ...config,
        break_start: '10:00:00+00',
        break_end: '10:30:00+00',
      };
      const slots = generateSlotsFromConfig(withBreak, '2026-03-07', undefined, 30);
      const times = slots.map((s) => s.start_time.toISOString());
      expect(times).not.toContain('2026-03-07T10:00:00.000Z');
      expect(times.some((t) => t.startsWith('2026-03-07T10:30'))).toBe(true);
    });

    it('generates for date range', () => {
      const slots = generateSlotsFromConfig(config, '2026-03-07', '2026-03-08', 60);
      expect(slots.length).toBe(8);
      expect(slots[0].start_time.toISOString()).toContain('2026-03-07');
      expect(slots[4].start_time.toISOString()).toContain('2026-03-08');
    });
  });

  describe('deleteSlot', () => {
    const stationId = 's1';
    const slotId = 'slot1';

    it('throws NotFoundError when slot not found or wrong station', async () => {
      mockFindSlotByIdAndStation.mockResolvedValue(undefined);
      await expect(deleteSlot(stationId, slotId)).rejects.toThrow(NotFoundError);
      expect(mockDeleteSlotById).not.toHaveBeenCalled();
    });

    it('throws ConflictError when slot has reservations', async () => {
      mockFindSlotByIdAndStation.mockResolvedValue({ id: slotId } as any);
      mockCountReservationsBySlotId.mockResolvedValue(1);
      await expect(deleteSlot(stationId, slotId)).rejects.toThrow(ConflictError);
      expect(mockDeleteSlotById).not.toHaveBeenCalled();
    });

    it('deletes when slot belongs to station and has no reservations', async () => {
      mockFindSlotByIdAndStation.mockResolvedValue({ id: slotId } as any);
      mockCountReservationsBySlotId.mockResolvedValue(0);
      mockDeleteSlotById.mockResolvedValue(undefined);
      await deleteSlot(stationId, slotId);
      expect(mockDeleteSlotById).toHaveBeenCalledWith(slotId);
    });
  });

  describe('generateAndPersistSlots', () => {
    const stationId = 's1';

    it('throws NotFoundError when station has no config', async () => {
      mockGetConfigByStationId.mockResolvedValue(undefined);
      await expect(
        generateAndPersistSlots(stationId, '2026-03-07')
      ).rejects.toThrow(NotFoundError);
      expect(mockGetConfigByStationId).toHaveBeenCalledWith(stationId);
      expect(mockCreateSlots).not.toHaveBeenCalled();
    });

    it('calls createSlots and returns slots when config exists', async () => {
      mockGetConfigByStationId.mockResolvedValue(config);
      const created = [
        {
          id: 'slot1',
          station_id: stationId,
          start_time: new Date('2026-03-07T08:00:00.000Z'),
          end_time: new Date('2026-03-07T08:30:00.000Z'),
          capacity: 2,
          booked_count: 0,
          status: 'available',
        },
      ];
      mockCreateSlots.mockResolvedValue(created);
      const result = await generateAndPersistSlots(stationId, '2026-03-07');
      expect(result).toEqual(created);
      expect(mockCreateSlots).toHaveBeenCalled();
    });
  });
});
