const mockGetActiveCommissionRate = jest.fn();
const mockIsStationCommissionExempt = jest.fn();

jest.mock('@/server/admin/platform-settings-service', () => ({
  getActiveCommissionRate: (...args: unknown[]) => mockGetActiveCommissionRate(...args),
}));

jest.mock('@/server/admin/subscription-service', () => ({
  isStationCommissionExempt: (...args: unknown[]) => mockIsStationCommissionExempt(...args),
}));

import { computeReservationSplit } from '@/server/reservations/compute-reservation-split';

const STATION_ID = '00000000-0000-0000-0000-000000000001';

describe('compute-reservation-split', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: station bills via commission (not exempt).
    mockIsStationCommissionExempt.mockResolvedValue(false);
  });

  it('returns 0% commission for QR bookings', async () => {
    const result = await computeReservationSplit({ stationId: STATION_ID, amountTotal: 12, isQrBooking: true });
    expect(result).toEqual({
      bookingSource: 'qr',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: 12,
    });
    expect(mockGetActiveCommissionRate).not.toHaveBeenCalled();
  });

  it('computes standard commission in cents to avoid drift', async () => {
    mockGetActiveCommissionRate.mockResolvedValue('0.10');
    const result = await computeReservationSplit({ stationId: STATION_ID, amountTotal: 10.01, isQrBooking: false });

    expect(result).toEqual({
      bookingSource: 'standard',
      commissionRate: '0.10',
      commissionAmount: 1,
      stationPayout: 9.01,
    });
    expect(result.commissionAmount + result.stationPayout).toBe(10.01);
  });

  it('takes no commission when the station has an active subscription', async () => {
    mockIsStationCommissionExempt.mockResolvedValue(true);
    const result = await computeReservationSplit({ stationId: STATION_ID, amountTotal: 50, isQrBooking: false });

    expect(result).toEqual({
      bookingSource: 'standard',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: 50,
    });
    expect(mockGetActiveCommissionRate).not.toHaveBeenCalled();
  });

  it('still charges commission when subscription model is set but not active (unpaid)', async () => {
    mockIsStationCommissionExempt.mockResolvedValue(false);
    mockGetActiveCommissionRate.mockResolvedValue('0.10');
    const result = await computeReservationSplit({ stationId: STATION_ID, amountTotal: 100, isQrBooking: false });

    expect(result.commissionAmount).toBe(10);
    expect(result.stationPayout).toBe(90);
  });

  it('normalizes amountTotal to 2 decimals before split computation', async () => {
    const result = await computeReservationSplit({ stationId: STATION_ID, amountTotal: 10.005, isQrBooking: true });
    expect(result).toEqual({
      bookingSource: 'qr',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: 10.01,
    });
  });

  it('throws when standard commission rate config is invalid', async () => {
    mockGetActiveCommissionRate.mockResolvedValue('not-a-number');
    await expect(
      computeReservationSplit({ stationId: STATION_ID, amountTotal: 10, isQrBooking: false })
    ).rejects.toThrow('Invalid commission rate configuration');
  });
});
