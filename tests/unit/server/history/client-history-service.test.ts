/**
 * Unit tests for client history service contracts.
 * @jest-environment node
 */
const mockListClientHistory = jest.fn();
const mockFindClientHistoryReceiptByEntryId = jest.fn();
const mockGetStripeReceiptUrl = jest.fn();

jest.mock('@/server/history/client-history-repository', () => ({
  listClientHistory: (...args: unknown[]) => mockListClientHistory(...args),
  findClientHistoryReceiptByEntryId: (...args: unknown[]) => mockFindClientHistoryReceiptByEntryId(...args),
}));
jest.mock('@/server/payments/payment-service', () => ({
  getStripeReceiptUrl: (...args: unknown[]) => mockGetStripeReceiptUrl(...args),
}));

import {
  getClientHistory,
  getClientHistoryReceiptDetail,
  getClientHistoryReceiptPdf,
} from '@/server/history/client-history-service';
import { NotFoundError } from '@/lib/errors';

const date = new Date('2026-03-23T10:00:00.000Z');
const row = {
  id: '11111111-1111-4111-8111-111111111111',
  created_at: date,
  status: 'completed',
  entry_type: 'reservation' as const,
  amount_paid: '25.00',
  commission_amount: '2.50',
  tip_amount: '1.50',
  stripe_payment_id: 'pi_123',
  station_name: 'Station Centrale',
  station_address: '1 rue de la Gare',
  station_city: 'Paris',
  vehicle_format_label: 'SUV',
  slot_start_time: new Date('2026-03-23T11:00:00.000Z'),
};

describe('client-history-service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies default statuses, default sorting and returns full pagination meta', async () => {
    mockListClientHistory.mockResolvedValue({
      items: [row],
      total: 25,
    });

    const result = await getClientHistory('client-1', { page: 2, limit: 10 });

    expect(mockListClientHistory).toHaveBeenCalledWith({
      userId: 'client-1',
      statuses: ['confirmed', 'in_progress', 'completed', 'cancelled'],
      page: 2,
      limit: 10,
      entry_type: undefined,
      from: undefined,
      to: undefined,
      amount_min: undefined,
      amount_max: undefined,
      q: undefined,
      sort_order: 'desc',
    });
    expect(result.meta).toEqual({
      total: 25,
      page: 2,
      limit: 10,
      total_pages: 3,
      has_next_page: true,
      has_prev_page: true,
    });
  });

  it('passes explicit filters including q and custom sort order', async () => {
    mockListClientHistory.mockResolvedValue({ items: [], total: 0 });

    await getClientHistory('client-1', {
      page: 1,
      limit: 20,
      status: ['completed', 'cancelled'],
      entry_type: 'queue',
      from: '2026-03-01',
      to: '2026-03-23',
      amount_min: 2,
      amount_max: 15,
      q: '23/03/2026',
      sort_by: 'created_at',
      sort_order: 'asc',
    });

    expect(mockListClientHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ['completed', 'cancelled'],
        entry_type: 'queue',
        from: '2026-03-01',
        to: '2026-03-23',
        amount_min: 2,
        amount_max: 15,
        q: '23/03/2026',
        sort_order: 'asc',
      })
    );
  });

  it('maps receipt_type to stripe_link when stripe reference exists', async () => {
    mockListClientHistory.mockResolvedValue({
      items: [{ ...row, amount_paid: '0.00', stripe_payment_id: 'pi_123' }],
      total: 1,
    });

    const result = await getClientHistory('client-1', {});

    expect(result.items[0]?.receipt_available).toBe(true);
    expect(result.items[0]?.receipt_type).toBe('stripe_link');
  });

  it('returns stripe + app receipt when both are available', async () => {
    mockFindClientHistoryReceiptByEntryId.mockResolvedValue(row);
    mockGetStripeReceiptUrl.mockResolvedValue('https://pay.stripe.com/receipts/pi_123');

    const result = await getClientHistoryReceiptDetail('client-1', row.id);

    expect(mockFindClientHistoryReceiptByEntryId).toHaveBeenCalledWith('client-1', row.id);
    expect(mockGetStripeReceiptUrl).toHaveBeenCalledWith('pi_123');
    expect(result.stripe_receipt_url).toBe('https://pay.stripe.com/receipts/pi_123');
    expect(result.app_receipt?.amount.total).toBe('25.00');
    expect(result.app_receipt?.service.title).toBe('SUV - Station Centrale');
  });

  it('returns app receipt with null stripe url when stripe lookup fails', async () => {
    mockFindClientHistoryReceiptByEntryId.mockResolvedValue(row);
    mockGetStripeReceiptUrl.mockRejectedValue(new Error('Stripe timeout'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await getClientHistoryReceiptDetail('client-1', row.id);

    expect(result.stripe_receipt_url).toBeNull();
    expect(result.app_receipt).not.toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('drops untrusted stripe receipt URL from service payload', async () => {
    mockFindClientHistoryReceiptByEntryId.mockResolvedValue(row);
    mockGetStripeReceiptUrl.mockResolvedValue('https://evil.example/fake-receipt');

    const result = await getClientHistoryReceiptDetail('client-1', row.id);

    expect(result.stripe_receipt_url).toBeNull();
    expect(result.app_receipt).not.toBeNull();
  });

  it('drops stripe URLs that are not receipt paths', async () => {
    mockFindClientHistoryReceiptByEntryId.mockResolvedValue(row);
    mockGetStripeReceiptUrl.mockResolvedValue('https://pay.stripe.com/payment_intents/pi_123');

    const result = await getClientHistoryReceiptDetail('client-1', row.id);

    expect(result.stripe_receipt_url).toBeNull();
    expect(result.app_receipt).not.toBeNull();
  });

  it('throws NotFoundError for missing/foreign receipt entry', async () => {
    mockFindClientHistoryReceiptByEntryId.mockResolvedValue(undefined);

    await expect(getClientHistoryReceiptDetail('client-1', row.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns pdf payload with stripe url when available', async () => {
    mockFindClientHistoryReceiptByEntryId.mockResolvedValue(row);
    mockGetStripeReceiptUrl.mockResolvedValue('https://pay.stripe.com/receipts/pi_123');

    const result = await getClientHistoryReceiptPdf('client-1', row.id);

    expect(result.filename).toBe(`receipt-${row.id}.pdf`);
    expect(result.stripe_receipt_url).toBe('https://pay.stripe.com/receipts/pi_123');
    expect(result.text_lines[0]).toContain('Slowtime - Recu Client');
  });

  it('returns fallback pdf text when app receipt is unavailable', async () => {
    mockFindClientHistoryReceiptByEntryId.mockResolvedValue({
      ...row,
      amount_paid: '0.00',
      stripe_payment_id: null,
    });

    const result = await getClientHistoryReceiptPdf('client-1', row.id);

    expect(result.stripe_receipt_url).toBeNull();
    expect(result.app_receipt).toBeNull();
    expect(result.text_lines).toEqual(['Receipt unavailable']);
  });
});
