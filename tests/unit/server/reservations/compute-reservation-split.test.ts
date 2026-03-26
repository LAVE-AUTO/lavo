const mockGetActiveCommissionRate = jest.fn();

jest.mock('@/server/admin/platform-settings-service', () => ({
  getActiveCommissionRate: (...args: unknown[]) => mockGetActiveCommissionRate(...args),
}));

import { computeReservationSplit } from '@/server/reservations/compute-reservation-split';

describe('compute-reservation-split', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0% commission for QR bookings', async () => {
    const result = await computeReservationSplit({ amountTotal: 12, isQrBooking: true });
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
    const result = await computeReservationSplit({ amountTotal: 10.01, isQrBooking: false });

    expect(result).toEqual({
      bookingSource: 'standard',
      commissionRate: '0.10',
      commissionAmount: 1,
      stationPayout: 9.01,
    });
    expect(result.commissionAmount + result.stationPayout).toBe(10.01);
  });

  it('normalizes amountTotal to 2 decimals before split computation', async () => {
    const result = await computeReservationSplit({ amountTotal: 10.005, isQrBooking: true });
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
      computeReservationSplit({ amountTotal: 10, isQrBooking: false })
    ).rejects.toThrow('Invalid commission rate configuration');
  });
});
