const mockGetActiveCommissionRate = jest.fn();
const mockGetPlatformServiceFee = jest.fn();

jest.mock('@/server/admin/platform-settings-service', () => ({
  getActiveCommissionRate: (...args: unknown[]) => mockGetActiveCommissionRate(...args),
  getPlatformServiceFee: (...args: unknown[]) => mockGetPlatformServiceFee(...args),
}));

import { computeReservationSplit } from '@/server/reservations/compute-reservation-split';

describe('compute-reservation-split', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPlatformServiceFee.mockResolvedValue('1.50');
  });

  it('returns the full financial snapshot for QR bookings', async () => {
    const result = await computeReservationSplit({ amountTotal: 12, isQrBooking: true });
    expect(result).toEqual({
      bookingSource: 'qr',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: 13.8,
      station_service_total: 12,
      platform_service_fee: 1.5,
      taxable_subtotal: 13.5,
      tps_amount: 0.68,
      tvq_amount: 1.35,
      client_total: 15.53,
      platform_subtotal: 1.5,
      platform_tax_amount: 0.23,
      platform_total_retained: 1.73,
      station_subtotal: 12,
      station_tax_amount: 1.8,
      station_total_transferred: 13.8,
    });
    expect(mockGetActiveCommissionRate).not.toHaveBeenCalled();
    expect(mockGetPlatformServiceFee).toHaveBeenCalledTimes(1);
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
      stationPayout: 19.78,
      station_service_total: 18.5,
      platform_service_fee: 1.5,
      taxable_subtotal: 20,
      tps_amount: 1,
      tvq_amount: 2,
      client_total: 23,
      platform_subtotal: 2.8,
      platform_tax_amount: 0.42,
      platform_total_retained: 3.22,
      station_subtotal: 17.2,
      station_tax_amount: 2.58,
      station_total_transferred: 19.78,
    });
    expect(result.platform_total_retained + result.station_total_transferred).toBe(23);
    expect(mockGetActiveCommissionRate).toHaveBeenCalledTimes(1);
    expect(mockGetPlatformServiceFee).toHaveBeenCalledTimes(1);
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
      stationPayout: 21.27,
      station_service_total: 18.5,
      platform_service_fee: 1.5,
      taxable_subtotal: 20,
      tps_amount: 1,
      tvq_amount: 2,
      client_total: 23,
      platform_subtotal: 1.5,
      platform_tax_amount: 0.23,
      platform_total_retained: 1.73,
      station_subtotal: 18.5,
      station_tax_amount: 2.77,
      station_total_transferred: 21.27,
    });
  });

  it('computes standard commission in cents to avoid drift', async () => {
    mockGetActiveCommissionRate.mockResolvedValue('0.10');
    const result = await computeReservationSplit({ amountTotal: 10.01, isQrBooking: false });

    expect(result).toEqual({
      bookingSource: 'standard',
      commissionRate: '0.10',
      commissionAmount: 1,
      stationPayout: 10.36,
      station_service_total: 10.01,
      platform_service_fee: 1.5,
      taxable_subtotal: 11.51,
      tps_amount: 0.58,
      tvq_amount: 1.15,
      client_total: 13.24,
      platform_subtotal: 2.5,
      platform_tax_amount: 0.38,
      platform_total_retained: 2.88,
      station_subtotal: 9.01,
      station_tax_amount: 1.35,
      station_total_transferred: 10.36,
    });
    expect(result.platform_total_retained + result.station_total_transferred).toBeCloseTo(13.24, 2);
  });

  it('normalizes amountTotal to 2 decimals before split computation', async () => {
    const result = await computeReservationSplit({ amountTotal: 10.005, isQrBooking: true });
    expect(result).toEqual({
      bookingSource: 'qr',
      commissionRate: '0.0000',
      commissionAmount: 0,
      stationPayout: 11.51,
      station_service_total: 10.01,
      platform_service_fee: 1.5,
      taxable_subtotal: 11.51,
      tps_amount: 0.58,
      tvq_amount: 1.15,
      client_total: 13.24,
      platform_subtotal: 1.5,
      platform_tax_amount: 0.23,
      platform_total_retained: 1.73,
      station_subtotal: 10.01,
      station_tax_amount: 1.5,
      station_total_transferred: 11.51,
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

  it('throws when the platform service fee config is invalid', async () => {
    mockGetActiveCommissionRate.mockResolvedValue('0.14');
    mockGetPlatformServiceFee.mockResolvedValue('-1');

    await expect(
      computeReservationSplit({
        amountTotal: 10,
        isQrBooking: false,
      })
    ).rejects.toThrow('Invalid platform service fee configuration');
  });
});
