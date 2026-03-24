/**
 * API tests for GET /api/v1/history/client.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetClientHistory = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/history/client-history-service', () => ({
  getClientHistory: (...args: unknown[]) => mockGetClientHistory(...args),
}));

import { GET } from '@/app/api/v1/history/client/route';
import { AppError } from '@/lib/errors';

const clientAuth = { sub: 'client-1', role: 'client' };

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/v1/history/client${query ? `?${query}` : ''}`);
}

describe('GET /api/v1/history/client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(clientAuth);
    mockGetClientHistory.mockResolvedValue({
      items: [],
      meta: {
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      },
    });
  });

  it('returns 200 with paginated history and full meta', async () => {
    const res = await GET(makeRequest('page=2&limit=10'));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('pragma')).toBe('no-cache');
    expect(res.headers.get('vary')).toContain('Authorization');
    expect(res.headers.get('vary')).toContain('Cookie');
    const data = await res.json();
    expect(data.data.meta).toEqual({
      total: 0,
      page: 1,
      limit: 20,
      total_pages: 0,
      has_next_page: false,
      has_prev_page: false,
    });
    expect(mockGetClientHistory).toHaveBeenCalledWith(
      clientAuth.sub,
      expect.objectContaining({ page: 2, limit: 10 })
    );
  });

  it('parses filters and passes strict status values (csv + multi-param)', async () => {
    const res = await GET(
      makeRequest(
        [
          'status=completed,cancelled',
          'status=confirmed',
          'entry_type=reservation',
          'from=2026-03-01',
          'to=2026-03-23',
          'amount_min=1.50',
          'amount_max=99.99',
          'q=Station Centrale',
          'sort_by=created_at',
          'sort_order=desc',
        ].join('&')
      )
    );

    expect(res.status).toBe(200);
    expect(mockGetClientHistory).toHaveBeenCalledWith(clientAuth.sub, {
      page: undefined,
      limit: undefined,
      status: ['completed', 'cancelled', 'confirmed'],
      entry_type: 'reservation',
      from: '2026-03-01',
      to: '2026-03-23',
      amount_min: 1.5,
      amount_max: 99.99,
      q: 'Station Centrale',
      sort_by: 'created_at',
      sort_order: 'desc',
    });
  });

  it('rejects invalid enum in status filter', async () => {
    const res = await GET(makeRequest('status=pending'));

    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('pragma')).toBe('no-cache');
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockGetClientHistory).not.toHaveBeenCalled();
  });

  it('rejects invalid date input for from/to filters', async () => {
    const res = await GET(makeRequest('from=23/03/2026&to=2026-03-23'));

    expect(res.status).toBe(400);
    expect(mockGetClientHistory).not.toHaveBeenCalled();
  });

  it('rejects invalid pagination boundaries', async () => {
    const res = await GET(makeRequest('page=0&limit=101'));

    expect(res.status).toBe(400);
    expect(mockGetClientHistory).not.toHaveBeenCalled();
  });

  it('rejects invalid amount range when min > max', async () => {
    const res = await GET(makeRequest('amount_min=20&amount_max=10'));

    expect(res.status).toBe(400);
    expect(mockGetClientHistory).not.toHaveBeenCalled();
  });

  it('returns auth response when unauthorized', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(mockGetClientHistory).not.toHaveBeenCalled();
  });

  it('returns auth response when forbidden', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockGetClientHistory).not.toHaveBeenCalled();
  });

  it('maps AppError from service to controlled response', async () => {
    mockGetClientHistory.mockRejectedValueOnce(new AppError('Access denied to this resource', 403));

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toBe('Access denied to this resource');
    expect(body.code).toBe('FORBIDDEN');
  });
});
