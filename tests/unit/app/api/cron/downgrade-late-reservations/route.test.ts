/**
 * API tests for GET /api/cron/downgrade-late-reservations.
 * Mocks runDowngradeLateReservations and CRON_SECRET env.
 * @jest-environment node
 */
const mockRunDowngradeLateReservations = jest.fn();

jest.mock('@/jobs/downgrade-late-reservations', () => ({
  runDowngradeLateReservations: (...args: unknown[]) =>
    mockRunDowngradeLateReservations(...args),
}));

const CRON_SECRET = 'test-cron-secret';
const mockHeadersGet = jest.fn((key: string): string | null => {
  if (key === 'x-cron-secret') return CRON_SECRET;
  if (key === 'authorization') return null;
  return null;
});

jest.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: mockHeadersGet }),
}));

import { GET } from '@/app/api/cron/downgrade-late-reservations/route';

const originalEnv = process.env;

describe('GET /api/cron/downgrade-late-reservations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 200 with correct x-cron-secret header and result', async () => {
    mockHeadersGet.mockImplementation((key: string) =>
      key === 'x-cron-secret' ? CRON_SECRET : null
    );
    mockRunDowngradeLateReservations.mockResolvedValueOnce({
      processed: 3,
      succeeded: 2,
      failed: 1,
      errors: [{ entryId: 'entry-1', error: 'Slot full' }],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      processed: 3,
      succeeded: 2,
      failed: 1,
      errors: [{ entryId: 'entry-1', error: 'Slot full' }],
    });
    expect(mockRunDowngradeLateReservations).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when secret missing', async () => {
    mockHeadersGet.mockImplementation(() => null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/cron secret/i);
    expect(mockRunDowngradeLateReservations).not.toHaveBeenCalled();
  });

  it('returns 401 when secret wrong', async () => {
    mockHeadersGet.mockImplementation((key: string) =>
      key === 'x-cron-secret' ? 'wrong-secret' : null
    );
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/cron secret/i);
    expect(mockRunDowngradeLateReservations).not.toHaveBeenCalled();
  });

  it('returns 200 when Authorization Bearer matches CRON_SECRET', async () => {
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'x-cron-secret') return null;
      if (key === 'authorization') return `Bearer ${CRON_SECRET}`;
      return null;
    });
    mockRunDowngradeLateReservations.mockResolvedValueOnce({
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockRunDowngradeLateReservations).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when Authorization Bearer has no token', async () => {
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'x-cron-secret') return null;
      if (key === 'authorization') return 'Bearer';
      return null;
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockRunDowngradeLateReservations).not.toHaveBeenCalled();
  });

  it('returns 500 when runDowngradeLateReservations throws', async () => {
    mockHeadersGet.mockImplementation((key: string) =>
      key === 'x-cron-secret' ? CRON_SECRET : null
    );
    mockRunDowngradeLateReservations.mockRejectedValueOnce(new Error('DB error'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(mockRunDowngradeLateReservations).toHaveBeenCalledTimes(1);
  });
});
