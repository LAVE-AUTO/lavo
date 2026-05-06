/**
 * Unit tests for delay-service: listDelaysByStation.
 * All DB dependencies are mocked; no real DB calls are made.
 * @jest-environment node
 */

// %%%%% Mocks %%%%%

const mockListDelayRequestsByStation = jest.fn();

jest.mock('@/server/reservations/delay-repository', () => ({
  listDelayRequestsByStation: (...args: unknown[]) =>
    mockListDelayRequestsByStation(...args),
}));

jest.mock('@/lib/db', () => ({ db: {} }));
jest.mock('@/server/station/station-repository', () => ({}));
jest.mock('@/server/notifications/notification-service', () => ({}));
jest.mock('@/server/reservations/entry-repository', () => ({}));


// %%%%% Imports %%%%%

import { listDelaysByStation } from '@/server/reservations/delay-service';


// %%%%% Fixtures %%%%%

const makeDelay = (overrides: Partial<{
  id: string;
  reservation_id: string;
  user_id: string;
  station_id: string;
  status: string;
  message: string | null;
  refusal_reason: string | null;
  created_at: Date;
  updated_at: Date;
  reservation: { id: string; scheduled_at: Date | null; vehicle_format_id: string } | null;
}> = {}) => ({
  id: 'delay-1',
  reservation_id: 'res-1',
  user_id: 'user-1',
  station_id: 'station-1',
  status: 'pending',
  message: null,
  refusal_reason: null,
  created_at: new Date('2026-04-01T10:00:00Z'),
  updated_at: new Date('2026-04-01T10:00:00Z'),
  reservation: {
    id: 'res-1',
    scheduled_at: new Date('2026-04-01T12:00:00Z'),
    vehicle_format_id: 'vf-1',
  },
  ...overrides,
});

const STATION_ID = 'station-abc';


// %%%%% Setup %%%%%

beforeEach(() => {
  jest.clearAllMocks();
});


// %%%%% Tests %%%%%

describe('listDelaysByStation', () => {
  it('returns paginated results from the repository', async () => {
    const delays = [makeDelay(), makeDelay({ id: 'delay-2', status: 'accepted' })];
    mockListDelayRequestsByStation.mockResolvedValue({
      rows: delays,
      total: 2,
      page: 1,
      perPage: 20,
    });

    const result = await listDelaysByStation(STATION_ID, { page: 1, perPage: 20 });

    expect(mockListDelayRequestsByStation).toHaveBeenCalledWith(STATION_ID, { page: 1, perPage: 20 });
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(20);
  });

  it('filters by status=pending - only pending rows returned', async () => {
    const pending = [makeDelay({ status: 'pending' })];
    mockListDelayRequestsByStation.mockResolvedValue({
      rows: pending,
      total: 1,
      page: 1,
      perPage: 20,
    });

    const result = await listDelaysByStation(STATION_ID, { status: 'pending' });

    expect(mockListDelayRequestsByStation).toHaveBeenCalledWith(STATION_ID, { status: 'pending' });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('pending');
  });

  it('returns page 2 items when requested', async () => {
    const secondPage = [makeDelay({ id: 'delay-21', status: 'refused' })];
    mockListDelayRequestsByStation.mockResolvedValue({
      rows: secondPage,
      total: 21,
      page: 2,
      perPage: 20,
    });

    const result = await listDelaysByStation(STATION_ID, { page: 2, perPage: 20 });

    expect(mockListDelayRequestsByStation).toHaveBeenCalledWith(STATION_ID, { page: 2, perPage: 20 });
    expect(result.page).toBe(2);
    expect(result.rows[0].id).toBe('delay-21');
  });

  it('passes stationId to repository - station sees only its own delays', async () => {
    mockListDelayRequestsByStation.mockResolvedValue({ rows: [], total: 0, page: 1, perPage: 20 });

    await listDelaysByStation('other-station');

    expect(mockListDelayRequestsByStation).toHaveBeenCalledWith('other-station', {});
  });

  it('returns empty result when station has no delay requests', async () => {
    mockListDelayRequestsByStation.mockResolvedValue({ rows: [], total: 0, page: 1, perPage: 20 });

    const result = await listDelaysByStation(STATION_ID);

    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('propagates repository errors without swallowing them', async () => {
    mockListDelayRequestsByStation.mockRejectedValue(new Error('DB connection lost'));

    await expect(listDelaysByStation(STATION_ID)).rejects.toThrow('DB connection lost');
  });

  it('uses default options when none provided', async () => {
    mockListDelayRequestsByStation.mockResolvedValue({ rows: [], total: 0, page: 1, perPage: 20 });

    await listDelaysByStation(STATION_ID);

    expect(mockListDelayRequestsByStation).toHaveBeenCalledWith(STATION_ID, {});
  });

  it('includes reservation context in returned rows', async () => {
    const delay = makeDelay({
      reservation: {
        id: 'res-99',
        scheduled_at: new Date('2026-04-02T09:00:00Z'),
        vehicle_format_id: 'vf-99',
      },
    });
    mockListDelayRequestsByStation.mockResolvedValue({ rows: [delay], total: 1, page: 1, perPage: 20 });

    const result = await listDelaysByStation(STATION_ID);

    expect(result.rows[0].reservation).toMatchObject({
      id: 'res-99',
      vehicle_format_id: 'vf-99',
    });
    expect(result.rows[0].reservation?.scheduled_at).toBeInstanceOf(Date);
  });
});
