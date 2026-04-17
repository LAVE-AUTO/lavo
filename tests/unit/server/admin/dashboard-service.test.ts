/**
 * Unit tests for getDashboardData in dashboard-service.
 * @jest-environment node
 */
const mockGetStationCounts = jest.fn();
const mockGetTotalClients = jest.fn();
const mockGetOpenSupportTickets = jest.fn();
const mockGetReservationMetrics = jest.fn();
const mockGetPendingKycAlerts = jest.fn();
const mockGetOpenTicketAlerts = jest.fn();

jest.mock('@/server/admin/dashboard-repository', () => ({
  getStationCounts: (...args: unknown[]) => mockGetStationCounts(...args),
  getTotalClients: (...args: unknown[]) => mockGetTotalClients(...args),
  getOpenSupportTickets: (...args: unknown[]) => mockGetOpenSupportTickets(...args),
  getReservationMetrics: (...args: unknown[]) => mockGetReservationMetrics(...args),
  getPendingKycAlerts: (...args: unknown[]) => mockGetPendingKycAlerts(...args),
  getOpenTicketAlerts: (...args: unknown[]) => mockGetOpenTicketAlerts(...args),
}));

import { getDashboardData } from '@/server/admin/dashboard-service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const stationCountsFixture = { active_stations: 15, pending_kyc: 4 };
const totalClientsFixture = 312;
const openSupportTicketsFixture = 7;
const reservationMetricsFixture = {
  total_transactions: 88,
  total_revenue: '4500.50',
  total_commissions: '450.05',
};
const pendingKycAlertsFixture = [
  {
    station_id: 'station-uuid-0001',
    station_name: 'Station Alpha',
    city: 'Montreal',
    legal_name: 'Alpha Corp',
    registration_number: 'REG-001',
    rejection_count: 0,
    owner_id: 'user-uuid-0001',
    owner_email: 'alpha@example.com',
    owner_first_name: 'Jean',
    owner_last_name: 'Dupont',
    submitted_at: new Date('2026-01-15T10:00:00Z'),
  },
];
const openTicketAlertsFixture = [
  {
    ticket_id: 'ticket-uuid-0001',
    ticket_number: 'SUP-AAAA0001',
    subject: 'Machine broken',
    category: 'technique',
    priority: 'high',
    status: 'ouvert',
    assigned_to_id: null,
    assigned_to_email: null,
    assigned_to_name: null,
    created_by_id: 'user-uuid-0002',
    created_by_email: 'user@example.com',
    created_by_first_name: 'Marie',
    created_by_last_name: 'Curie',
    created_at: new Date('2026-03-01T08:00:00Z'),
    updated_at: new Date('2026-03-01T08:00:00Z'),
  },
];

// ---------------------------------------------------------------------------
// getDashboardData
// ---------------------------------------------------------------------------

describe('getDashboardData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStationCounts.mockResolvedValue(stationCountsFixture);
    mockGetTotalClients.mockResolvedValue(totalClientsFixture);
    mockGetOpenSupportTickets.mockResolvedValue(openSupportTicketsFixture);
    mockGetReservationMetrics.mockResolvedValue(reservationMetricsFixture);
    mockGetPendingKycAlerts.mockResolvedValue(pendingKycAlertsFixture);
    mockGetOpenTicketAlerts.mockResolvedValue(openTicketAlertsFixture);
  });

  // --- All 6 repository calls are invoked ---

  it('invokes all 6 repository functions exactly once via Promise.all', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');

    await getDashboardData(from, to, 84);

    expect(mockGetStationCounts).toHaveBeenCalledTimes(1);
    expect(mockGetTotalClients).toHaveBeenCalledTimes(1);
    expect(mockGetOpenSupportTickets).toHaveBeenCalledTimes(1);
    expect(mockGetReservationMetrics).toHaveBeenCalledTimes(1);
    expect(mockGetPendingKycAlerts).toHaveBeenCalledTimes(1);
    expect(mockGetOpenTicketAlerts).toHaveBeenCalledTimes(1);
  });

  it('passes the from and to dates to getReservationMetrics', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59Z');

    await getDashboardData(from, to, 84);

    expect(mockGetReservationMetrics).toHaveBeenCalledWith(from, to);
  });

  // --- Output shape: monetary fields are strings ---

  it('includes total_revenue as a string in the metrics output', async () => {
    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(typeof result.metrics.total_revenue).toBe('string');
    expect(result.metrics.total_revenue).toBe('4500.50');
  });

  it('includes total_commissions as a string in the metrics output', async () => {
    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(typeof result.metrics.total_commissions).toBe('string');
    expect(result.metrics.total_commissions).toBe('450.05');
  });

  // --- period fields are formatted as YYYY-MM-DD ---

  it('formats period.from as YYYY-MM-DD using UTC components', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59.999Z');

    const result = await getDashboardData(from, to, 84);

    expect(result.period.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.period.from).toBe('2026-01-01');
  });

  it('formats period.to as YYYY-MM-DD using UTC components', async () => {
    const from = new Date('2026-01-01T00:00:00Z');
    const to = new Date('2026-03-26T23:59:59.999Z');

    const result = await getDashboardData(from, to, 84);

    expect(result.period.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.period.to).toBe('2026-03-26');
  });

  it('sets period.days to the value passed in', async () => {
    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result.period.days).toBe(84);
  });

  it('sets period.days to 30 when 30 is passed (default window)', async () => {
    const result = await getDashboardData(
      new Date('2026-02-24T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      30
    );

    expect(result.period.days).toBe(30);
  });

  // --- Null/zero DB values are handled correctly ---

  it('handles zero transaction count and returns "0" strings for revenue when DB returns zero values', async () => {
    mockGetReservationMetrics.mockResolvedValueOnce({
      total_transactions: 0,
      total_revenue: '0',
      total_commissions: '0',
    });

    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result.metrics.total_transactions).toBe(0);
    expect(result.metrics.total_revenue).toBe('0');
    expect(result.metrics.total_commissions).toBe('0');
  });

  it('returns zero counts in totals when DB returns zero values', async () => {
    mockGetStationCounts.mockResolvedValueOnce({ active_stations: 0, pending_kyc: 0 });
    mockGetTotalClients.mockResolvedValueOnce(0);
    mockGetOpenSupportTickets.mockResolvedValueOnce(0);

    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result.totals.active_stations).toBe(0);
    expect(result.totals.total_clients).toBe(0);
    expect(result.totals.pending_kyc).toBe(0);
    expect(result.totals.open_support_tickets).toBe(0);
  });

  // --- Output structure completeness ---

  it('returns a result with all required top-level keys', async () => {
    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result).toHaveProperty('period');
    expect(result).toHaveProperty('totals');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('alerts');
  });

  it('maps station counts to totals correctly', async () => {
    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result.totals.active_stations).toBe(stationCountsFixture.active_stations);
    expect(result.totals.pending_kyc).toBe(stationCountsFixture.pending_kyc);
    expect(result.totals.total_clients).toBe(totalClientsFixture);
    expect(result.totals.open_support_tickets).toBe(openSupportTicketsFixture);
  });

  it('includes pending_kyc alert list in alerts', async () => {
    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result.alerts.pending_kyc).toEqual(pendingKycAlertsFixture);
  });

  it('includes open_support_tickets alert list in alerts', async () => {
    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result.alerts.open_support_tickets).toEqual(openTicketAlertsFixture);
  });

  it('returns empty arrays for alerts when no pending items exist', async () => {
    mockGetPendingKycAlerts.mockResolvedValueOnce([]);
    mockGetOpenTicketAlerts.mockResolvedValueOnce([]);

    const result = await getDashboardData(
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-03-26T23:59:59Z'),
      84
    );

    expect(result.alerts.pending_kyc).toEqual([]);
    expect(result.alerts.open_support_tickets).toEqual([]);
  });
});
