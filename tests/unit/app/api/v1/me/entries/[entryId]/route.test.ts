/**
 * API tests for GET /api/v1/me/entries/:entryId.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockGetMyRichEntry = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/reservations/reservation-service', () => ({
  getMyRichEntry: (...args: unknown[]) => mockGetMyRichEntry(...args),
}));

import { GET } from '@/app/api/v1/me/entries/[entryId]/route';
import { NotFoundError } from '@/lib/errors';

const userAuth = { sub: 'user-1', role: 'user' };
const entryId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const mockRichEntry = {
  id: entryId,
  user_id: 'user-1',
  entry_type: 'reservation',
  booking_source: 'standard',
  time_slot_id: 'slot-1',
  station_id: 'station-1',
  vehicle_format_id: 'format-1',
  status: 'confirmed',
  queue_position: null,
  amount_paid: '15.00',
  created_at: new Date(),
  updated_at: new Date(),
  station: {
    id: 'station-1',
    name: 'Station A',
    address: '1 Rue Test',
    city: 'Montreal',
    latitude: null,
    longitude: null,
    image_url: 'https://res.cloudinary.com/test/image.jpg',
    free_cancellation_minutes: 60,
  },
  vehicle_format: { id: 'format-1', label: 'Petit', price: '15.00' },
  is_rated: false,
  is_tipped: false,
  estimated_wait_minutes: null,
};

function buildParams(id: string): Promise<{ entryId: string }> {
  return Promise.resolve({ entryId: id });
}

describe('GET /api/v1/me/entries/:entryId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(userAuth);
    mockGetMyRichEntry.mockResolvedValue(mockRichEntry);
  });

  it('returns 200 with rich entry when found', async () => {
    const req = new Request(`http://localhost/api/v1/me/entries/${entryId}`);
    const res = await GET(req, { params: buildParams(entryId) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe(entryId);
    expect(body.data.station.name).toBe('Station A');
    expect(body.data.vehicle_format.label).toBe('Petit');
    expect(body.data.is_rated).toBe(false);
    expect(mockGetMyRichEntry).toHaveBeenCalledWith(entryId, userAuth.sub);
  });

  it('returns 404 when entry not found', async () => {
    mockGetMyRichEntry.mockResolvedValueOnce(undefined);
    const req = new Request(`http://localhost/api/v1/me/entries/${entryId}`);
    const res = await GET(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
  });

  it('returns 400 for invalid UUID param', async () => {
    const req = new Request('http://localhost/api/v1/me/entries/not-a-uuid');
    const res = await GET(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    expect(mockGetMyRichEntry).not.toHaveBeenCalled();
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request(`http://localhost/api/v1/me/entries/${entryId}`);
    const res = await GET(req, { params: buildParams(entryId) });
    expect(res.status).toBe(401);
    expect(mockGetMyRichEntry).not.toHaveBeenCalled();
  });
});
