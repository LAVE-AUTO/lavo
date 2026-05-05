/**
 * API tests for GET /api/v1/me/entries.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockListMyRichEntries = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/reservations/reservation-service', () => ({
  listMyRichEntries: (...args: unknown[]) => mockListMyRichEntries(...args),
}));

import { GET } from '@/app/api/v1/me/entries/route';

const userAuth = { sub: 'user-1', role: 'user' };

const mockRichEntry = {
  id: 'entry-1',
  user_id: 'user-1',
  entry_type: 'reservation',
  booking_source: 'standard',
  time_slot_id: 'slot-1',
  station_id: 'station-1',
  vehicle_format_id: 'format-1',
  status: 'pending',
  queue_position: null,
  amount_paid: '12.00',
  created_at: new Date(),
  updated_at: new Date(),
  station: {
    id: 'station-1',
    name: 'Test Station',
    address: '123 Main St',
    city: 'Montreal',
    latitude: null,
    longitude: null,
    image_url: null,
    free_cancellation_minutes: 60,
  },
  vehicle_format: { id: 'format-1', label: 'Petit', price: '12.00' },
  is_rated: false,
  is_tipped: false,
  estimated_wait_minutes: null,
};

function makeRequest(query = ''): Request {
  return new Request(`http://localhost/api/v1/me/entries${query ? `?${query}` : ''}`);
}

describe('GET /api/v1/me/entries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(userAuth);
    mockListMyRichEntries.mockResolvedValue({
      rows: [mockRichEntry],
      total: 1,
      page: 1,
      per_page: 20,
    });
  });

  it('returns 200 with paginated entries when authenticated as user', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data.data.entries)).toBe(true);
    expect(data.data.entries[0].entry_type).toBe('reservation');
    expect(data.data.entries[0].station.name).toBe('Test Station');
    expect(data.data.entries[0].is_rated).toBe(false);
    expect(data.data.total).toBe(1);
    expect(data.data.page).toBe(1);
    expect(mockListMyRichEntries).toHaveBeenCalledWith(userAuth.sub, expect.objectContaining({ page: 1 }));
  });

  it('passes query params to service', async () => {
    const res = await GET(makeRequest('status=confirmed&page=2&per_page=10'));
    expect(res.status).toBe(200);
    expect(mockListMyRichEntries).toHaveBeenCalledWith(
      userAuth.sub,
      expect.objectContaining({ status: 'confirmed', page: 2, per_page: 10 })
    );
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(mockListMyRichEntries).not.toHaveBeenCalled();
  });

  it('returns 403 when role is not user', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mockListMyRichEntries).not.toHaveBeenCalled();
  });
});
