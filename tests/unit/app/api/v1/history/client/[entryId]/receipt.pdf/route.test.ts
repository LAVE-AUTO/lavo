/**
 * API tests for GET /api/v1/history/client/:entryId/receipt.pdf.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetClientHistoryReceiptPdf = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/history/client-history-service', () => ({
  getClientHistoryReceiptPdf: (...args: unknown[]) => mockGetClientHistoryReceiptPdf(...args),
}));

import { GET } from '@/app/api/v1/history/client/[entryId]/receipt.pdf/route';
import { AppError, NotFoundError } from '@/lib/errors';

const clientAuth = { sub: 'client-1', role: 'client' };
const entryId = '11111111-1111-4111-8111-111111111111';

function makeRequest(): Request {
  return new Request(`http://localhost/api/v1/history/client/${entryId}/receipt.pdf`);
}

describe('GET /api/v1/history/client/:entryId/receipt.pdf', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockGetClientHistoryReceiptPdf.mockResolvedValue({
      filename: `receipt-${entryId}.pdf`,
      stripe_receipt_url: null,
      app_receipt: { entry_id: entryId, reference: 'pi_123' },
      text_lines: ['Receipt line 1', 'Receipt line 2'],
    });
  });

  it('returns 302 redirect when stripe receipt URL exists', async () => {
    mockGetClientHistoryReceiptPdf.mockResolvedValueOnce({
      filename: `receipt-${entryId}.pdf`,
      stripe_receipt_url: 'https://pay.stripe.com/receipts/acct_123/rcpt_123',
      app_receipt: null,
      text_lines: ['Receipt unavailable'],
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('https://pay.stripe.com/receipts/acct_123/rcpt_123');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('falls back to generated PDF when redirect URL is not trusted', async () => {
    mockGetClientHistoryReceiptPdf.mockResolvedValueOnce({
      filename: `receipt-${entryId}.pdf`,
      stripe_receipt_url: 'https://evil.example/stripe-redirect',
      app_receipt: null,
      text_lines: ['Receipt line 1'],
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });

  it('falls back to generated PDF when stripe URL path is not a receipt path', async () => {
    mockGetClientHistoryReceiptPdf.mockResolvedValueOnce({
      filename: `receipt-${entryId}.pdf`,
      stripe_receipt_url: 'https://pay.stripe.com/invoices/inv_123',
      app_receipt: null,
      text_lines: ['Receipt line 1'],
    });

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
  });

  it('returns generated PDF when stripe receipt is unavailable', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(`inline; filename="receipt-${entryId}.pdf"`);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');

    const bytes = new Uint8Array(await res.arrayBuffer());
    const text = Buffer.from(bytes).toString('utf8');
    expect(text).toContain('%PDF-1.4');
    expect(text).toContain('(Receipt line 1) Tj');
  });

  it('returns 400 for invalid entryId', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId: 'invalid-id' }) });
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('pragma')).toBe('no-cache');
    expect(mockGetClientHistoryReceiptPdf).not.toHaveBeenCalled();
  });

  it('returns 404 when entry is not found/owned by another user', async () => {
    mockGetClientHistoryReceiptPdf.mockRejectedValueOnce(new NotFoundError('History entry not found'));

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(404);
  });

  it('maps AppError response from service', async () => {
    mockGetClientHistoryReceiptPdf.mockRejectedValueOnce(new AppError('Forbidden receipt access', 403));

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(403);
  });
});
