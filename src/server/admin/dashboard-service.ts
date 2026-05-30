/**
 * Service for the admin dashboard.
 * Orchestrates all repository calls in parallel and maps results to the response shape.
 */
import {
  getStationCounts,
  getTotalClients,
  getOpenSupportTickets,
  getReservationMetrics,
  getPendingKycAlerts,
  getOpenTicketAlerts,
} from './dashboard-repository';
import type { PendingKycAlert, OpenTicketAlert } from './dashboard-repository';
import { formatDateUTC } from '@/validators/shared';

/** Formatted date string in YYYY-MM-DD format. */
type DateString = string;

/**
 * Effective period used for flow KPIs (revenue, transactions, etc.).
 * Includes the date range and number of days for client-side calculations.
 */
type DashboardPeriod = {
  from: DateString;
  to: DateString;
  days: number;
};

/**
 * All-time stock KPIs - independent of date range.
 * Represents current state of the platform (active stations, total clients, etc.).
 */
type DashboardTotals = {
  active_stations: number;
  total_clients: number;
  pending_kyc: number;
  open_support_tickets: number;
};

/**
 * Flow KPIs filtered by the requested period.
 * Represents activity within the dashboard's date range.
 */
type DashboardMetrics = {
  total_transactions: number;
  total_revenue: string;
  total_commissions: string;
};

/**
 * Actionable alert lists - current state, no date filter.
 * Admin-facing lists of items requiring immediate attention.
 */
type DashboardAlerts = {
  pending_kyc: PendingKycAlert[];
  open_support_tickets: OpenTicketAlert[];
};

/**
 * Full shape of the dashboard data returned to the route handler.
 * Combines period, totals, metrics, and alerts into a single response.
 */
export type DashboardData = {
  period: DashboardPeriod;
  totals: DashboardTotals;
  metrics: DashboardMetrics;
  alerts: DashboardAlerts;
};

/**
 * Fetches all admin dashboard data for the given date range.
 *
 * All 6 repository queries are run in parallel via Promise.all to minimise
 * wall-clock latency (total time = slowest query, not sum of all).
 *
 * Promise.all: fail-fast - if any single DB query rejects, the whole dashboard returns 500.
 * This is intentional for simplicity; the dashboard is an admin-only tool and partial data
 * is not surfaced. If resilience to individual query failures becomes a requirement,
 * switch to Promise.allSettled and surface partial data in the response shape.
 *
 * @param from  - Start of the period (inclusive).
 * @param to    - End of the period (inclusive).
 * @param days  - Number of days in the period (pre-computed by resolveDateRange).
 * @returns     DashboardData mapped to the API response structure.
 */
export async function getDashboardData(
  from: Date,
  to: Date,
  days: number
): Promise<DashboardData> {
  const [
    stationCounts,
    totalClients,
    openSupportTickets,
    reservationMetrics,
    pendingKycAlerts,
    openTicketAlerts,
  ] = await Promise.all([
    getStationCounts(),
    getTotalClients(),
    getOpenSupportTickets(),
    getReservationMetrics(from, to),
    getPendingKycAlerts(),
    getOpenTicketAlerts(),
  ]);

  return {
    period: {
      from: formatDateUTC(from),
      to: formatDateUTC(to),
      days,
    },
    totals: {
      active_stations: stationCounts.active_stations,
      total_clients: totalClients,
      pending_kyc: stationCounts.pending_kyc,
      open_support_tickets: openSupportTickets,
    },
    metrics: {
      total_transactions: reservationMetrics.total_transactions,
      total_revenue: reservationMetrics.total_revenue,
      total_commissions: reservationMetrics.total_commissions,
    },
    alerts: {
      pending_kyc: pendingKycAlerts,
      open_support_tickets: openTicketAlerts,
    },
  };
}
