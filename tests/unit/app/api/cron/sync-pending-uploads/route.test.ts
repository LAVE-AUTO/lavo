/**
 * API tests for GET /api/cron/sync-pending-uploads.
 * Mocks runSyncPendingUploads and CRON_SECRET env.
 * @jest-environment node
 */
const mockRunSyncPendingUploads = jest.fn();

jest.mock('@/jobs/sync-pending-uploads', () => ({
  runSyncPendingUploads: (...args: unknown[]) =>
    mockRunSyncPendingUploads(...args),
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

import { GET } from '@/app/api/cron/sync-pending-uploads/route';

const originalEnv = process.env;

describe('GET /api/cron/sync-pending-uploads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 200 with correct x-cron-secret header and processed count', async () => {
    mockHeadersGet.mockImplementation((key: string) =>
      key === 'x-cron-secret' ? CRON_SECRET : null
    );
    mockRunSyncPendingUploads.mockResolvedValueOnce({
      processed: 5,
      succeeded: 4,
      failed: 1,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      processed: 5,
      succeeded: 4,
      failed: 1,
    });
    expect(mockRunSyncPendingUploads).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when secret missing', async () => {
    mockHeadersGet.mockImplementation(() => null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/cron secret/i);
    expect(mockRunSyncPendingUploads).not.toHaveBeenCalled();
  });

  it('returns 401 when secret wrong', async () => {
    mockHeadersGet.mockImplementation((key: string) =>
      key === 'x-cron-secret' ? 'wrong-secret' : null
    );
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/cron secret/i);
    expect(mockRunSyncPendingUploads).not.toHaveBeenCalled();
  });

  it('returns 200 when Authorization Bearer matches CRON_SECRET', async () => {
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'x-cron-secret') return null;
      if (key === 'authorization') return `Bearer ${CRON_SECRET}`;
      return null;
    });
    mockRunSyncPendingUploads.mockResolvedValueOnce({
      processed: 0,
      succeeded: 0,
      failed: 0,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockRunSyncPendingUploads).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when Authorization Bearer has no token', async () => {
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'x-cron-secret') return null;
      if (key === 'authorization') return 'Bearer';
      return null;
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockRunSyncPendingUploads).not.toHaveBeenCalled();
  });
});
