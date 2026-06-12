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

  it('applies the configured promo reduction to the platform commission without changing the booking source', async () => {
    mockGetActiveCommissionRate.mockResolvedValue('0.14');
    const result = await computeReservationSplit({
      amountTotal: 18.5,
      isQrBooking: false,
      promotionReductionRate: '0.50',
    });
    expect(result).toEqual({
      bookingSource: 'standard',
      commissionRate: '0.0700',
      commissionAmount: 1.3,
      stationPayout: 17.2,
    });
    expect(result.commissionAmount + result.stationPayout).toBe(18.5);
    expect(mockGetActiveCommissionRate).toHaveBeenCalledTimes(1);
  });

  it('reduces the commission to 0 when the promo reduction is 100%', async () => {
    mockGetActiveCommissionRate.mockResolvedValue('0.14');
    const result = await computeReservationSplit({
      amountTotal: 18.5,
      isQrBooking: false,
      promotionReductionRate: '1.0000',
    });
    expect(result).toEqual({
      bookingSource: 'standard',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: 18.5,
    });
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

  it('throws when the promo reduction rate config is invalid', async () => {
    mockGetActiveCommissionRate.mockResolvedValue('0.14');
    await expect(
      computeReservationSplit({
        amountTotal: 10,
        isQrBooking: false,
        promotionReductionRate: '2',
      })
    ).rejects.toThrow('Invalid promotion reduction rate configuration');
  });
});
