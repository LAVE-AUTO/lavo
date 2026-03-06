import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { stations, timeSlots } from '@/lib/db/schema';

export type Station = typeof stations.$inferSelect;
export type NewStation = typeof stations.$inferInsert;

export type ListActiveStationsFilters = {
  search?: string;
  city?: string;
  sort?: 'slots_asc' | 'slots_desc' | 'name';
};

export async function createStation(data: NewStation): Promise<Station> {
  const [station] = await db.insert(stations).values(data).returning();
  return station;
}

export async function findStationById(id: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.id, id) });
}

/**
 * Lists stations with status 'active', optional search (q) on name/address/city,
 * optional city filter, and optional sort (by available slots or name).
 */
export async function listActiveStations(
  filters: ListActiveStationsFilters = {}
): Promise<Station[]> {
  const { search, city, sort } = filters;
  const conditions = [eq(stations.status, 'active')];
  if (city) conditions.push(eq(stations.city, city));
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(stations.name, term),
        ilike(stations.address, term),
        ilike(stations.city, term)
      )!
    );
  }
  const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);

  const baseQuery = db
    .select()
    .from(stations)
    .where(whereClause);

  if (sort === 'name') {
    return baseQuery.orderBy(asc(stations.name));
  }
  if (sort === 'slots_desc') {
    const slotsSubquery = sql`(SELECT COALESCE(SUM(${timeSlots.capacity} - ${timeSlots.booked_count}), 0)::bigint FROM time_slots WHERE time_slots.station_id = ${stations.id} AND time_slots.start_time > NOW())`;
    return baseQuery.orderBy(desc(slotsSubquery));
  }
  if (sort === 'slots_asc') {
    const slotsSubquery = sql`(SELECT COALESCE(SUM(${timeSlots.capacity} - ${timeSlots.booked_count}), 0)::bigint FROM time_slots WHERE time_slots.station_id = ${stations.id} AND time_slots.start_time > NOW())`;
    return baseQuery.orderBy(asc(slotsSubquery));
  }
  return baseQuery;
}

/**
 * Finds an active station by id with stationConfig, vehicleFormats, and timeSlots.
 * Returns undefined if not found or station is not active.
 */
export async function findActiveStationWithDetail(id: string) {
  return db.query.stations.findFirst({
    where: and(eq(stations.id, id), eq(stations.status, 'active')),
    with: {
      stationConfig: true,
      vehicleFormats: true,
      timeSlots: true,
    },
  });
}

export async function findStationByUserId(userId: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.user_id, userId) });
}

export async function listStationsByStatus(status: string): Promise<Station[]> {
  return db.query.stations.findMany({ where: eq(stations.status, status) });
}

export async function updateStationStatus(
  id: string,
  status: string,
  extra?: Partial<Pick<Station, 'approved_by' | 'approved_at' | 'rejection_reason'>>
): Promise<void> {
  await db
    .update(stations)
    .set({ status, updated_at: new Date(), ...extra })
    .where(eq(stations.id, id));
}

export async function updateStationInfo(
  id: string,
  data: Partial<NewStation>
): Promise<Station> {
  const [updated] = await db
    .update(stations)
    .set({ ...data, updated_at: new Date() })
    .where(eq(stations.id, id))
    .returning();
  return updated;
}
