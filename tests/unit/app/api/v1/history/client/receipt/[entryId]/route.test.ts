/**
 * API tests for GET /api/v1/history/client/receipt/:entryId.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetClientHistoryReceiptDetail = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/history/client-history-service', () => ({
  getClientHistoryReceiptDetail: (...args: unknown[]) => mockGetClientHistoryReceiptDetail(...args),
}));

import { GET } from '@/app/api/v1/history/client/receipt/[entryId]/route';
import { AppError, NotFoundError } from '@/lib/errors';

const clientAuth = { sub: 'client-1', role: 'client' };
const entryId = '11111111-1111-4111-8111-111111111111';

function makeRequest(): Request {
  return new Request('http://localhost/api/v1/history/client/receipt/' + entryId);
}

describe('GET /api/v1/history/client/receipt/:entryId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockGetClientHistoryReceiptDetail.mockResolvedValue({
      entry_id: entryId,
      stripe_receipt_url: 'https://stripe.example/receipt',
      app_receipt: {
        entry_id: entryId,
        reference: 'pi_123',
      },
    });
  });

  it('returns receipt detail with stripe + app payload when both are available', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('pragma')).toBe('no-cache');
    expect(res.headers.get('vary')).toContain('Authorization');
    expect(res.headers.get('vary')).toContain('Cookie');
    const body = await res.json();
    expect(body.data.entry_id).toBe(entryId);
    expect(body.data.stripe_receipt_url).toBe('https://stripe.example/receipt');
    expect(body.data.app_receipt).not.toBeNull();
    expect(mockGetClientHistoryReceiptDetail).toHaveBeenCalledWith(clientAuth.sub, entryId);
  });

  it('returns 400 for invalid entryId format', async () => {
    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId: 'invalid-id' }) });

    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('pragma')).toBe('no-cache');
    expect(mockGetClientHistoryReceiptDetail).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthorized', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mockGetClientHistoryReceiptDetail).not.toHaveBeenCalled();
  });

  it('returns 403 when forbidden', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(403);
    expect(mockGetClientHistoryReceiptDetail).not.toHaveBeenCalled();
  });

  it('returns 404 for ownership/not-found scenario', async () => {
    mockGetClientHistoryReceiptDetail.mockRejectedValueOnce(new NotFoundError('History entry not found'));

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('History entry not found');
  });

  it('maps controlled AppError from service', async () => {
    mockGetClientHistoryReceiptDetail.mockRejectedValueOnce(new AppError('Forbidden receipt access', 403));

    const res = await GET(makeRequest(), { params: Promise.resolve({ entryId }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe('FORBIDDEN');
  });
});
