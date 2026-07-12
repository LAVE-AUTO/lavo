/**
 * Unit tests for runSendEscrowWeeklyTransactionsReport: recipient env and validateEmail gate.
 * @jest-environment node
 */
jest.mock('@/lib/email', () => ({
  sendWeeklyEscrowTransactionsReportEmail: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/server/admin/platform-settings-service', () => ({
  getPlatformSetting: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/db', () => {
  const mockOrderBy = jest.fn().mockResolvedValue([]);
  const mockWhere = jest.fn().mockReturnValue({ orderBy: mockOrderBy });
  const mockInnerJoin2 = jest.fn().mockReturnValue({ where: mockWhere });
  const mockInnerJoin1 = jest.fn().mockReturnValue({ innerJoin: mockInnerJoin2 });
  const mockFrom = jest.fn().mockReturnValue({ innerJoin: mockInnerJoin1 });
  const mockSelect = jest.fn().mockReturnValue({ from: mockFrom });
  (global as unknown as { __weeklyReportDbMocks: { mockSelect: jest.Mock; mockOrderBy: jest.Mock } }).__weeklyReportDbMocks = {
    mockSelect,
    mockOrderBy,
  };
  return { db: { select: mockSelect } };
});

import { sendWeeklyEscrowTransactionsReportEmail } from '@/lib/email';
import { runSendEscrowWeeklyTransactionsReport } from '@/jobs/send-escrow-weekly-transactions-report';

const originalEnv = process.env;

function getDbMocks() {
  return (global as unknown as { __weeklyReportDbMocks: { mockSelect: jest.Mock; mockOrderBy: jest.Mock } }).__weeklyReportDbMocks;
}

describe('runSendEscrowWeeklyTransactionsReport', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    process.env = { ...originalEnv };
    delete process.env.WEEKLY_TRANSACTIONS_REPORT_EMAIL;
    delete process.env.ADMIN_NOTIFICATION_EMAIL;
    getDbMocks().mockOrderBy.mockResolvedValue([]);
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns emailSent false and does not send when no recipient env is set', async () => {
    const result = await runSendEscrowWeeklyTransactionsReport();
    expect(result.emailSent).toBe(false);
    expect(result.processed).toBe(0);
    expect(sendWeeklyEscrowTransactionsReportEmail).not.toHaveBeenCalled();
    expect(getDbMocks().mockSelect).not.toHaveBeenCalled();
  });

  it('returns emailSent false and does not send when recipient fails validateEmail', async () => {
    process.env.WEEKLY_TRANSACTIONS_REPORT_EMAIL = 'not-an-email';
    const result = await runSendEscrowWeeklyTransactionsReport();
    expect(result.emailSent).toBe(false);
    expect(result.processed).toBe(0);
    expect(sendWeeklyEscrowTransactionsReportEmail).not.toHaveBeenCalled();
    expect(getDbMocks().mockSelect).not.toHaveBeenCalled();
  });

  it('uses locale en when WEEKLY_REPORT_LOCALE is en', async () => {
    process.env.WEEKLY_TRANSACTIONS_REPORT_EMAIL = 'weekly@example.com';
    process.env.WEEKLY_REPORT_LOCALE = 'EN';
    getDbMocks().mockOrderBy.mockResolvedValueOnce([]);

    await runSendEscrowWeeklyTransactionsReport();

    expect(sendWeeklyEscrowTransactionsReportEmail).toHaveBeenCalledWith(
      'weekly@example.com',
      expect.objectContaining({ locale: 'en' })
    );
  });

  it('uses ADMIN_NOTIFICATION_EMAIL when WEEKLY_TRANSACTIONS_REPORT_EMAIL is empty and email is valid', async () => {
    process.env.ADMIN_NOTIFICATION_EMAIL = ' ops@example.com ';
    getDbMocks().mockOrderBy.mockResolvedValueOnce([]);

    const result = await runSendEscrowWeeklyTransactionsReport();

    expect(result.emailSent).toBe(true);
    expect(result.processed).toBe(0);
    expect(sendWeeklyEscrowTransactionsReportEmail).toHaveBeenCalledTimes(1);
    expect(sendWeeklyEscrowTransactionsReportEmail).toHaveBeenCalledWith(
      'ops@example.com',
      expect.objectContaining({
        locale: expect.any(String),
        weekStart: expect.any(Date),
        weekEnd: expect.any(Date),
        rows: [],
      })
    );
    expect(getDbMocks().mockSelect).toHaveBeenCalled();
  });

  it('sends when WEEKLY_TRANSACTIONS_REPORT_EMAIL is valid and forwards row count', async () => {
    process.env.WEEKLY_TRANSACTIONS_REPORT_EMAIL = 'weekly@example.com';
    const succeededAt = new Date('2026-01-05T12:00:00.000Z');
    getDbMocks().mockOrderBy.mockResolvedValueOnce([
      {
        reservationId: 'res-1',
        reservationStatus: 'confirmed',
        succeededAt,
        clientEmail: 'client@example.com',
        stationName: 'Station A',
        amountPaid: 1000,
        commissionAmount: 100,
        stationPayout: 900,
        stripePaymentId: 'pi_x',
        stripeTransferId: 'tr_x',
      },
    ]);

    const result = await runSendEscrowWeeklyTransactionsReport();

    expect(result.emailSent).toBe(true);
    expect(result.processed).toBe(1);
    expect(sendWeeklyEscrowTransactionsReportEmail).toHaveBeenCalledWith(
      'weekly@example.com',
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            reservationId: 'res-1',
            succeededAt,
            stationName: 'Station A',
          }),
        ],
      })
    );
  });

  it('maps the weekly report to the retained and transferred financial snapshot amounts', async () => {
    process.env.WEEKLY_TRANSACTIONS_REPORT_EMAIL = 'weekly@example.com';
    const succeededAt = new Date('2026-01-05T12:00:00.000Z');
    getDbMocks().mockOrderBy.mockResolvedValueOnce([
      {
        reservationId: 'res-2',
        reservationStatus: 'completed',
        succeededAt,
        clientEmail: 'client@example.com',
        stationName: 'Station B',
        amountPaid: '20.00',
        commissionAmount: '2.00',
        stationPayout: '18.00',
        clientTotal: '23.00',
        platformTotalRetained: '4.60',
        stationTotalTransferred: '18.40',
        stripePaymentId: 'pi_y',
        stripeTransferId: 'tr_y',
      },
    ]);

    await runSendEscrowWeeklyTransactionsReport();

    expect(sendWeeklyEscrowTransactionsReportEmail).toHaveBeenCalledWith(
      'weekly@example.com',
      expect.objectContaining({
        rows: [
          expect.objectContaining({
            reservationId: 'res-2',
            amountPaid: '23.00',
            commissionAmount: '4.60',
            stationPayout: '18.40',
          }),
        ],
      })
    );
  });
});
