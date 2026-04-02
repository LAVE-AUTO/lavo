/**
 * Data access for delay requests.
 * Isolated queries consumed by delay-service.ts.
 */
import { and, asc, count, eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { delayRequests, reservations, timeSlots } from '@/lib/db/schema';


// %%%%% Types %%%%%
// Delay request types with reservation context

export type DelayRequestWithReservation = typeof delayRequests.$inferSelect & {
  reservation: {
    id: string;
    scheduled_at: Date | null;
    vehicle_format_id: string;
  } | null;
};

export type ListDelaysOptions = {
  status?: string;
  page?: number;
  perPage?: number;
};


// %%%%% Database queries %%%%%
// Paginate and filter delay requests

/**
 * Paginates delay requests for a given station with optional status filter.
 * Joins reservation and time slot data for display context.
 *
 * @param stationId - UUID of the authenticated station
 * @param options   - Optional status filter and pagination (page, perPage)
 * @returns Paginated rows with nested reservation info and total count
 */
export async function listDelayRequestsByStation(
  stationId: string,
  options: ListDelaysOptions = {}
): Promise<{ rows: DelayRequestWithReservation[]; total: number; page: number; perPage: number }> {
  const { status, page = 1, perPage = 20 } = options;
  const offset = (page - 1) * perPage;

  const baseWhere =
    status && status !== 'all'
      ? and(eq(delayRequests.station_id, stationId), eq(delayRequests.status, status))
      : eq(delayRequests.station_id, stationId);

  const [countResult, rows] = await Promise.all([
    db.select({ value: count() }).from(delayRequests).where(baseWhere),
    db
      .select({
        id: delayRequests.id,
        reservation_id: delayRequests.reservation_id,
        user_id: delayRequests.user_id,
        station_id: delayRequests.station_id,
        status: delayRequests.status,
        message: delayRequests.message,
        refusal_reason: delayRequests.refusal_reason,
        created_at: delayRequests.created_at,
        updated_at: delayRequests.updated_at,
        reservation_vehicle_format_id: reservations.vehicle_format_id,
        slot_start_time: timeSlots.start_time,
      })
      .from(delayRequests)
      .leftJoin(reservations, eq(delayRequests.reservation_id, reservations.id))
      .leftJoin(timeSlots, eq(reservations.time_slot_id, timeSlots.id))
      .where(baseWhere)
      .orderBy(asc(delayRequests.created_at))
      .limit(perPage)
      .offset(offset),
  ]);

  const total = countResult[0]?.value ?? 0;

  const mapped: DelayRequestWithReservation[] = rows.map((r) => ({
    id: r.id,
    reservation_id: r.reservation_id,
    user_id: r.user_id,
    station_id: r.station_id,
    status: r.status,
    message: r.message ?? null,
    refusal_reason: r.refusal_reason ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    reservation: {
      id: r.reservation_id,
      scheduled_at: r.slot_start_time ?? null,
      vehicle_format_id: r.reservation_vehicle_format_id ?? '',
    },
  }));

  return { rows: mapped, total: Number(total), page, perPage };
}
