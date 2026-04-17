/**
 * Unit tests for availability-service: getStationSlotAvailability (mocked deps).
 * @jest-environment node
 */
const mockGetConfigByStationId = jest.fn();
const mockListSlotsByStationAndDate = jest.fn();

jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));
jest.mock('@/server/station/slot-repository', () => ({
  listSlotsByStationAndDate: (...args: unknown[]) => mockListSlotsByStationAndDate(...args),
}));
jest.mock('@/helpers/date-helper', () => ({
  parseTimeForDate: jest.fn((dateStr: string, timeStr: string) => new Date(`${dateStr}T${timeStr}Z`)),
}));

import { getStationSlotAvailability } from '@/server/station/availability-service';

const stationId = 'station-1';
const targetDate = '2026-04-17';

function makeSlot(overrides: Partial<{
  id: string;
  start_time: Date;
  end_time: Date;
  capacity: number;
  booked_count: number;
}>) {
  return {
    id: 'slot-1',
    station_id: stationId,
    capacity: 2,
    booked_count: 0,
    status: 'available',
    start_time: new Date('2026-04-17T10:00:00Z'),
    end_time: new Date('2026-04-17T10:30:00Z'),
    ...overrides,
  };
}

describe('availability-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfigByStationId.mockResolvedValue(null);
  });

  it('marks slot in the past as is_past: true and is_available: false', async () => {
    const pastSlot = makeSlot({
      start_time: new Date('2000-01-01T10:00:00Z'),
      end_time: new Date('2000-01-01T10:30:00Z'),
    });
    mockListSlotsByStationAndDate.mockResolvedValue([pastSlot]);

    const result = await getStationSlotAvailability(stationId, targetDate);

    expect(result[0].is_past).toBe(true);
    expect(result[0].is_available).toBe(false);
  });

  it('marks slot exceeding closing time as exceeds_closing_time: true and is_available: false', async () => {
    mockGetConfigByStationId.mockResolvedValue({ closing_time: '18:00:00' });

    const futureDate = '2099-12-31';
    const lateSlot = makeSlot({
      start_time: new Date(`${futureDate}T18:30:00Z`),
      end_time: new Date(`${futureDate}T19:00:00Z`),
    });
    mockListSlotsByStationAndDate.mockResolvedValue([lateSlot]);

    const result = await getStationSlotAvailability(stationId, futureDate);

    expect(result[0].exceeds_closing_time).toBe(true);
    expect(result[0].is_available).toBe(false);
  });

  it('marks slot with available_spots > 0, not past, not exceeding as is_available: true', async () => {
    const futureDate = '2099-12-31';
    const openSlot = makeSlot({
      start_time: new Date(`${futureDate}T10:00:00Z`),
      end_time: new Date(`${futureDate}T10:30:00Z`),
      capacity: 3,
      booked_count: 1,
    });
    mockListSlotsByStationAndDate.mockResolvedValue([openSlot]);

    const result = await getStationSlotAvailability(stationId, futureDate);

    expect(result[0].is_available).toBe(true);
    expect(result[0].available_spots).toBe(2);
    expect(result[0].is_past).toBe(false);
    expect(result[0].exceeds_closing_time).toBe(false);
  });

  it('available_spots is never negative when booked_count exceeds capacity', async () => {
    const futureDate = '2099-12-31';
    const overbookedSlot = makeSlot({
      start_time: new Date(`${futureDate}T10:00:00Z`),
      end_time: new Date(`${futureDate}T10:30:00Z`),
      capacity: 2,
      booked_count: 5,
    });
    mockListSlotsByStationAndDate.mockResolvedValue([overbookedSlot]);

    const result = await getStationSlotAvailability(stationId, futureDate);

    expect(result[0].available_spots).toBe(0);
    expect(result[0].is_available).toBe(false);
  });
});
