/**
 * API tests for POST /api/v1/me/entries/:entryId/upgrade-to-reservation.
 * @jest-environment node
 */
const mockRequireRole = jest.fn();
const mockFindEntryByIdAndUser = jest.fn();
const mockFindStationById = jest.fn();
const mockUpgradeQueueToReservation = jest.fn();

jest.mock('@/lib/require-role', () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));
jest.mock('@/server/reservations/entry-repository', () => ({
  findEntryByIdAndUser: (...args: unknown[]) => mockFindEntryByIdAndUser(...args),
}));
jest.mock('@/server/station/station-repository', () => ({
  findStationById: (...args: unknown[]) => mockFindStationById(...args),
}));
jest.mock('@/server/reservations/reservation-service', () => ({
  upgradeQueueToReservation: (...args: unknown[]) => mockUpgradeQueueToReservation(...args),
}));

import { POST } from '@/app/api/v1/me/entries/[entryId]/upgrade-to-reservation/route';
import { NotFoundError, ConflictError } from '@/lib/errors';

const userAuth = { sub: 'user-1', role: 'user' };
const entryId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const slotId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const stationId = 'c3d4e5f6-a7b8-9012-cdef-234567890123';
const stationStripeAccountId = 'acct_upgrade_test';

function buildParams(id: string): Promise<{ entryId: string }> {
  return Promise.resolve({ entryId: id });
}

describe('POST /api/v1/me/entries/:entryId/upgrade-to-reservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireRole.mockResolvedValue(userAuth);
    mockFindEntryByIdAndUser.mockResolvedValue({
      id: entryId,
      entry_type: 'queue',
      station_id: stationId,
      user_id: userAuth.sub,
    });
    mockFindStationById.mockResolvedValue({
      id: stationId,
      status: 'active',
      stripe_account_id: stationStripeAccountId,
    });
    mockUpgradeQueueToReservation.mockResolvedValue({
      entry: {
        id: entryId,
        entry_type: 'reservation',
        time_slot_id: slotId,
        station_id: stationId,
        vehicle_format_id: 'format-1',
        status: 'pending',
        queue_position: null,
        amount_paid: '12.00',
        created_at: new Date(),
        updated_at: new Date(),
      },
      clientSecret: 'pi_upgrade_secret',
    });
  });

  it('returns 201 with upgraded entry when valid body and own queue entry', async () => {
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId }),
    });
    const res = await POST(req, { params: buildParams(entryId) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.data.entry_type).toBe('reservation');
    expect(data.data.time_slot_id).toBe(slotId);
    expect(data.data.stripe_client_secret).toBe('pi_upgrade_secret');
    expect(mockUpgradeQueueToReservation).toHaveBeenCalledWith(
      entryId,
      userAuth.sub,
      slotId,
      stationId,
      stationStripeAccountId
    );
  });

  it('returns 400 for invalid entryId (non-UUID)', async () => {
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId }),
    });
    const res = await POST(req, { params: buildParams('not-a-uuid') });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpgradeQueueToReservation).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON body', async () => {
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    const res = await POST(req, { params: buildParams(entryId) });
    expect(res.status).toBe(400);
    expect(mockUpgradeQueueToReservation).not.toHaveBeenCalled();
  });

  it('returns 400 for missing time_slot_id in body', async () => {
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: buildParams(entryId) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(mockUpgradeQueueToReservation).not.toHaveBeenCalled();
  });

  it('returns 401 when auth fails', async () => {
    const errRes = new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
    mockRequireRole.mockResolvedValueOnce(errRes);
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId }),
    });
    const res = await POST(req, { params: buildParams(entryId) });
    expect(res.status).toBe(401);
    expect(mockUpgradeQueueToReservation).not.toHaveBeenCalled();
  });

  it('returns 404 when entry not found for user', async () => {
    mockFindEntryByIdAndUser.mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId }),
    });
    const res = await POST(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.message).toBe('Entry not found');
    expect(mockUpgradeQueueToReservation).not.toHaveBeenCalled();
  });

  it('returns 404 when upgradeQueueToReservation throws NotFoundError', async () => {
    mockUpgradeQueueToReservation.mockRejectedValueOnce(
      new NotFoundError('Time slot not found or does not belong to this station')
    );
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId }),
    });
    const res = await POST(req, { params: buildParams(entryId) });
    expect(res.status).toBe(404);
  });

  it('returns 409 when upgradeQueueToReservation throws ConflictError', async () => {
    mockUpgradeQueueToReservation.mockRejectedValueOnce(new ConflictError('Slot is full'));
    const req = new Request('http://localhost/api/v1/me/entries/1/upgrade-to-reservation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time_slot_id: slotId }),
    });
    const res = await POST(req, { params: buildParams(entryId) });
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe('Slot is full');
    expect(body.code).toBe('SLOT_FULL');
  });
});
