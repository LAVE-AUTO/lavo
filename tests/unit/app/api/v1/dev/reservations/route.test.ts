/**
 * API tests for POST /api/v1/dev/reservations.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindStationById = jest.fn();
const mockFindServiceVehicleEntryForBooking = jest.fn();
const mockGetConfigByStationId = jest.fn();
const mockComputeReservationSplit = jest.fn();
const mockHasActiveReservationForSlot = jest.fn();
const mockLockSlotForUpdate = jest.fn();
const mockCountReservationsBySlotId = jest.fn();
const mockIncrementSlotBookedCount = jest.fn();
const mockCreateReservationEntry = jest.fn();
const mockTransaction = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
}));
jest.mock('@/server/station/service-repository', () => ({
  findServiceVehicleEntryForBooking: (...args: unknown[]) =>
    mockFindServiceVehicleEntryForBooking(...args),
}));
jest.mock('@/server/station/config-repository', () => ({
  getConfigByStationId: (...args: unknown[]) => mockGetConfigByStationId(...args),
}));
jest.mock('@/server/reservations/compute-reservation-split', () => ({
  computeReservationSplit: (...args: unknown[]) => mockComputeReservationSplit(...args),
}));
jest.mock('@/server/station/slot-repository', () => ({
  lockSlotForUpdate: (...args: unknown[]) => mockLockSlotForUpdate(...args),
  countReservationsBySlotId: (...args: unknown[]) => mockCountReservationsBySlotId(...args),
  incrementSlotBookedCount: (...args: unknown[]) => mockIncrementSlotBookedCount(...args),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  hasActiveReservationForSlot: (...args: unknown[]) => mockHasActiveReservationForSlot(...args),
  createReservationEntry: (...args: unknown[]) => mockCreateReservationEntry(...args),
}));
jest.mock('@/lib/db', () => ({
  db: {
    transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

import { POST } from '@/app/api/v1/dev/reservations/route';

const auth = { sub: 'user-1', role: 'client' };
const stationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const slotId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const serviceId = 'd4e5f6a7-b8c9-0123-def4-345678901234';
const formatId = 'c3d4e5f6-a7b8-9012-cdef-234567890123';

describe('POST /api/v1/dev/reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    mockRequireRole.mockResolvedValue(auth);
    mockFindStationById.mockResolvedValue({ id: stationId, status: 'active' });
    mockFindServiceVehicleEntryForBooking.mockResolvedValue({ price: '12.00' });
    mockGetConfigByStationId.mockResolvedValue({ reservation_surcharge: '0.00' });
    mockComputeReservationSplit.mockResolvedValue({
      bookingSource: 'standard',
      commissionRate: '0.1000',
      commissionAmount: 1.2,
      stationPayout: 12.42,
      station_service_total: 12,
      platform_service_fee: 1,
      taxable_subtotal: 13,
      tps_amount: 0.65,
      tvq_amount: 1.3,
      client_total: 14.95,
      platform_subtotal: 2.2,
      platform_tax_amount: 0.38,
      platform_total_retained: 2.58,
      station_subtotal: 10.8,
      station_tax_amount: 1.57,
      station_total_transferred: 12.37,
    });
    mockTransaction.mockImplementation(async (cb: (tx: { kind: 'tx' }) => unknown) =>
      cb({ kind: 'tx' })
    );
    mockHasActiveReservationForSlot.mockResolvedValue(false);
    mockLockSlotForUpdate.mockResolvedValue({ id: slotId, capacity: 1 });
    mockCountReservationsBySlotId.mockResolvedValue(0);
    mockIncrementSlotBookedCount.mockResolvedValue(undefined);
    mockCreateReservationEntry.mockResolvedValue({
      id: 'entry-1',
      entry_type: 'reservation',
      station_id: stationId,
      vehicle_format_id: formatId,
      time_slot_id: slotId,
      status: 'confirmed',
      amount_paid: '14.95',
      commission_rate: '0.1000',
      commission_amount: '1.20',
      station_payout: '12.37',
      created_at: new Date('2026-07-07T10:00:00.000Z'),
      updated_at: new Date('2026-07-07T10:00:00.000Z'),
    });
  });

  it('persists the full financial snapshot instead of the raw service subtotal', async () => {
    const req = new Request('http://localhost/api/v1/dev/reservations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station_id: stationId,
        time_slot_id: slotId,
        service_id: serviceId,
        vehicle_format_id: formatId,
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreateReservationEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        amount_paid: '14.95',
        commission_rate: '0.1000',
        commission_amount: '1.20',
        station_payout: '12.37',
        station_service_total: '12.00',
        platform_service_fee: '1.00',
        taxable_subtotal: '13.00',
        tps_amount: '0.65',
        tvq_amount: '1.30',
        client_total: '14.95',
        platform_subtotal: '2.20',
        platform_tax_amount: '0.38',
        platform_total_retained: '2.58',
        station_subtotal: '10.80',
        station_tax_amount: '1.57',
        station_total_transferred: '12.37',
      }),
      expect.any(Object)
    );
  });
});
