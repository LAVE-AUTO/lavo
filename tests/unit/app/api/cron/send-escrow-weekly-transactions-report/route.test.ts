/**
 * API tests for GET /api/cron/send-escrow-weekly-transactions-report.
 * @jest-environment node
 */
const mockRunReport = jest.fn();

jest.mock('@/jobs/send-escrow-weekly-transactions-report', () => ({
  runSendEscrowWeeklyTransactionsReport: (...args: unknown[]) => mockRunReport(...args),
}));

const CRON_SECRET = 'test-cron-secret';
const mockHeadersGet = jest.fn((key: string) => {
  if (key === 'x-cron-secret') return CRON_SECRET;
  if (key === 'authorization') return null;
  return null;
});

jest.mock('next/headers', () => ({
  headers: () => Promise.resolve({ get: mockHeadersGet }),
}));

import { GET } from '@/app/api/cron/send-escrow-weekly-transactions-report/route';

const originalEnv = process.env;

describe('GET /api/cron/send-escrow-weekly-transactions-report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, CRON_SECRET };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 200 with correct secret and result', async () => {
    mockHeadersGet.mockImplementation((key: string) => (key === 'x-cron-secret' ? CRON_SECRET : null));
    mockRunReport.mockResolvedValueOnce({
      processed: 2,
      emailSent: true,
      weekStartISO: new Date('2026-01-01T00:00:00.000Z').toISOString(),
      weekEndISO: new Date('2026-01-08T00:00:00.000Z').toISOString(),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual({
      processed: 2,
      emailSent: true,
      weekStartISO: expect.any(String),
      weekEndISO: expect.any(String),
    });
    expect(mockRunReport).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when secret missing', async () => {
    mockHeadersGet.mockImplementation(() => null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/cron secret/i);
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  it('returns 401 when secret wrong', async () => {
    mockHeadersGet.mockImplementation((key: string) => (key === 'x-cron-secret' ? 'wrong-secret' : null));
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toMatch(/cron secret/i);
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  it('returns 200 when Authorization Bearer matches CRON_SECRET', async () => {
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'x-cron-secret') return null;
      if (key === 'authorization') return `Bearer ${CRON_SECRET}`;
      return null;
    });
    mockRunReport.mockResolvedValueOnce({
      processed: 0,
      emailSent: false,
      weekStartISO: new Date().toISOString(),
      weekEndISO: new Date().toISOString(),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockRunReport).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when Authorization Bearer has no token', async () => {
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'x-cron-secret') return null;
      if (key === 'authorization') return 'Bearer';
      return null;
    });
    const res = await GET();
    expect(res.status).toBe(401);
    expect(mockRunReport).not.toHaveBeenCalled();
  });

  it('returns 500 when job throws', async () => {
    mockHeadersGet.mockImplementation((key: string) => (key === 'x-cron-secret' ? CRON_SECRET : null));
    mockRunReport.mockRejectedValueOnce(new Error('DB error'));
    const res = await GET();
    expect(res.status).toBe(500);
    expect(mockRunReport).toHaveBeenCalledTimes(1);
  });
});

