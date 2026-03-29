/**
 * Unit tests for GET /api/v1/admin/disputes.
 * @jest-environment node
 */

const mockRequireRole = jest.fn();
const mockListDisputesAdmin = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

jest.mock('@/server/disputes/dispute-service', () => ({
  listDisputesAdmin: (...args: unknown[]) => mockListDisputesAdmin(...args),
}));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/v1/admin/disputes/route';

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const disputeItem = {
  id: 'dispute-uuid-1',
  reservation_id: VALID_UUID,
  client_id: 'client-1',
  station_id: 'station-1',
  reason: 'Rayure',
  status: 'open',
  created_at: new Date().toISOString(),
  station: { id: 'station-1', name: 'Station Paris', city: 'Paris', address: '1 rue de la Paix' },
};

const paginatedResult = {
  items: [disputeItem],
  meta: { total: 1, page: 1, per_page: 20, total_pages: 1 },
};

function makeRequest(query: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/v1/admin/disputes');
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

describe('GET /api/v1/admin/disputes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue({ sub: 'admin-1', role: 'admin' });
    mockListDisputesAdmin.mockResolvedValue(paginatedResult);
  });

  // --- Happy path ---

  it('returns 200 with items and pagination meta', async () => {
    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.meta.total).toBe(1);
    expect(body.data.meta.page).toBe(1);
    expect(body.data.meta.per_page).toBe(20);
    expect(mockListDisputesAdmin).toHaveBeenCalled();
  });

  it('forwards status filter to service', async () => {
    await GET(makeRequest({ status: 'open' }));
    expect(mockListDisputesAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'open' })
    );
  });

  it('forwards station_id and client_id filters to service', async () => {
    await GET(makeRequest({ station_id: VALID_UUID, client_id: VALID_UUID }));
    expect(mockListDisputesAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ station_id: VALID_UUID, client_id: VALID_UUID })
    );
  });

  it('forwards page and per_page as numbers', async () => {
    await GET(makeRequest({ page: '2', per_page: '50' }));
    expect(mockListDisputesAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, per_page: 50 })
    );
  });

  it('returns 200 with empty items when no disputes match', async () => {
    mockListDisputesAdmin.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 1, per_page: 20, total_pages: 0 },
    });
    const res = await GET(makeRequest({ status: 'resolved' }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(0);
    expect(body.data.meta.total).toBe(0);
  });

  // --- Auth ---

  it('returns auth response when requireRole fails (401)', async () => {
    mockRequireRole.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockListDisputesAdmin).not.toHaveBeenCalled();
  });

  // --- Validation ---

  it('returns 400 VALIDATION_FAILED for invalid status', async () => {
    const res = await GET(makeRequest({ status: 'pending' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockListDisputesAdmin).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_FAILED for invalid station_id (not UUID)', async () => {
    const res = await GET(makeRequest({ station_id: 'not-a-uuid' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 VALIDATION_FAILED for per_page > 100', async () => {
    const res = await GET(makeRequest({ per_page: '101' }));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // --- Service errors ---

  it('returns 500 on unexpected error', async () => {
    mockListDisputesAdmin.mockRejectedValue(new Error('DB failure'));
    const res = await GET(makeRequest());
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.code).toBe('INTERNAL_ERROR');
  });
});
