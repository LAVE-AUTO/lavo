/**
 * Data access functions for the admin dashboard.
 * All queries are designed for parallel execution via Promise.all.
 */
import { and, eq, inArray, lte, gte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations, users, reservations, supportTickets } from '@/lib/db/schema';

/** Shape of a pending KYC alert — station + owner details. */
export type PendingKycAlert = {
  station_id: string;
  station_name: string;
  city: string;
  legal_name: string | null;
  registration_number: string | null;
  rejection_count: number;
  owner_id: string | null;
  owner_email: string | null;
  owner_first_name: string | null;
  owner_last_name: string | null;
  submitted_at: Date;
};

/** Shape of an open support ticket alert — ticket + creator + assignee details. */
export type OpenTicketAlert = {
  ticket_id: string;
  ticket_number: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  assigned_to_id: string | null;
  assigned_to_email: string | null;
  assigned_to_name: string | null;
  created_by_id: string;
  created_by_email: string | null;
  created_by_first_name: string | null;
  created_by_last_name: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Returns the count of active stations and stations pending KYC validation
 * in a single SELECT using conditional aggregation.
 */
export async function getStationCounts(): Promise<{
  active_stations: number;
  pending_kyc: number;
}> {
  const result = await db
    .select({
      active_stations: sql<number>`COUNT(*) FILTER (WHERE ${stations.status} = 'active')::int`,
      pending_kyc: sql<number>`COUNT(*) FILTER (WHERE ${stations.status} = 'pending_admin_validation')::int`,
    })
    .from(stations);

  return {
    active_stations: result[0]?.active_stations ?? 0,
    pending_kyc: result[0]?.pending_kyc ?? 0,
  };
}

/**
 * Returns the total number of users with role = 'client'.
 */
export async function getTotalClients(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(users)
    .where(eq(users.role, 'client'));

  return result[0]?.count ?? 0;
}

/**
 * Returns the count of support tickets with status 'ouvert' or 'en_cours'.
 */
export async function getOpenSupportTickets(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(supportTickets)
    .where(inArray(supportTickets.status, ['ouvert', 'en_cours']));

  return result[0]?.count ?? 0;
}

/**
 * Returns transaction count, total revenue, and total commissions for
 * completed reservations whose `created_at` falls within [from, to].
 *
 * Monetary values are returned as strings to preserve decimal precision
 * and match the project convention (Drizzle decimal → string).
 */
export async function getReservationMetrics(
  from: Date,
  to: Date
): Promise<{
  total_transactions: number;
  total_revenue: string;
  total_commissions: string;
}> {
  const result = await db
    .select({
      total_transactions: sql<number>`COUNT(*)::int`,
      total_revenue: sql<string>`COALESCE(SUM(${reservations.amount_paid}), 0)::numeric::text`,
      total_commissions: sql<string>`COALESCE(SUM(${reservations.commission_amount}), 0)::numeric::text`,
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.status, 'completed'),
        gte(reservations.created_at, from),
        lte(reservations.created_at, to)
      )
    );

  return {
    total_transactions: result[0]?.total_transactions ?? 0,
    total_revenue: result[0]?.total_revenue ?? '0',
    total_commissions: result[0]?.total_commissions ?? '0',
  };
}

/**
 * Returns the list of stations currently pending admin KYC validation,
 * joined with the station owner's user record.
 * Ordered by stations.created_at ASC (oldest first = highest priority).
 */
export async function getPendingKycAlerts(): Promise<PendingKycAlert[]> {
  const rows = await db
    .select({
      station_id: stations.id,
      station_name: stations.name,
      city: stations.city,
      legal_name: stations.legal_name,
      registration_number: stations.registration_number,
      rejection_count: stations.rejection_count,
      owner_id: users.id,
      owner_email: users.email,
      owner_first_name: users.first_name,
      owner_last_name: users.last_name,
      submitted_at: stations.created_at,
    })
    .from(stations)
    .leftJoin(users, eq(stations.user_id, users.id))
    .where(eq(stations.status, 'pending_admin_validation'))
    .orderBy(stations.created_at);

  return rows.map((row) => ({
    station_id: row.station_id,
    station_name: row.station_name,
    city: row.city,
    legal_name: row.legal_name,
    registration_number: row.registration_number,
    rejection_count: row.rejection_count,
    owner_id: row.owner_id ?? null,
    owner_email: row.owner_email ?? null,
    owner_first_name: row.owner_first_name ?? null,
    owner_last_name: row.owner_last_name ?? null,
    submitted_at: row.submitted_at,
  }));
}

/**
 * Returns the list of open or in-progress support tickets, joined with
 * the creator user (INNER JOIN) and the assigned admin user (LEFT JOIN).
 * Ordered by created_at ASC (oldest first = highest priority).
 *
 * Uses a raw SQL query to support two JOINs on the same `users` table
 * with distinct aliases (creator_user, assignee_user).
 */
export async function getOpenTicketAlerts(): Promise<OpenTicketAlert[]> {
  const rows = await db.execute<{
    ticket_id: string;
    ticket_number: string;
    subject: string;
    category: string;
    priority: string;
    status: string;
    assigned_to_id: string | null;
    assigned_to_email: string | null;
    assigned_to_name: string | null;
    created_by_id: string;
    created_by_email: string | null;
    created_by_first_name: string | null;
    created_by_last_name: string | null;
    created_at: Date;
    updated_at: Date;
  }>(sql`
    SELECT
      st.id              AS ticket_id,
      st.ticket_number,
      st.subject,
      st.category,
      st.priority,
      st.status,
      au.id              AS assigned_to_id,
      au.email           AS assigned_to_email,
      CASE
        WHEN au.first_name IS NOT NULL OR au.last_name IS NOT NULL
        THEN TRIM(CONCAT(au.first_name, ' ', au.last_name))
        ELSE NULL
      END                AS assigned_to_name,
      cu.id              AS created_by_id,
      cu.email           AS created_by_email,
      cu.first_name      AS created_by_first_name,
      cu.last_name       AS created_by_last_name,
      st.created_at,
      st.updated_at
    FROM support_tickets st
    INNER JOIN users cu ON cu.id = st.created_by
    LEFT  JOIN users au ON au.id = st.assigned_to
    WHERE st.status IN ('ouvert', 'en_cours')
    ORDER BY st.created_at ASC
  `);

  return rows.rows.map((row) => ({
    ticket_id: row.ticket_id,
    ticket_number: row.ticket_number,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assigned_to_id: row.assigned_to_id ?? null,
    assigned_to_email: row.assigned_to_email ?? null,
    assigned_to_name: row.assigned_to_name ?? null,
    created_by_id: row.created_by_id,
    created_by_email: row.created_by_email ?? null,
    created_by_first_name: row.created_by_first_name ?? null,
    created_by_last_name: row.created_by_last_name ?? null,
    created_at: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updated_at: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  }));
}
