import { and, asc, desc, eq, getTableColumns, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, stationWashTypes, stations, timeSlots } from '@/lib/db/schema';
import type { StationSortCriterion } from '@/helpers/sort-stations';


// %%%%% Types %%%%%

export type Station = typeof stations.$inferSelect;
export type NewStation = typeof stations.$inferInsert;

export type ListActiveStationsFilters = {
  search?: string;
  city?: string;
  sort?: StationSortCriterion[];
  page?: number;
  per_page?: number;
  limit_per_group?: number;
  format_id?: string;
  /** Requested group keys; used by service only. */
  groups?: ('available_now' | 'most_appreciated' | 'most_visited')[];
  /** Filter to stations that have at least one of these wash type ids. */
  wash_type_ids?: string[];
  /** Filter to stations where service_scope equals this value (exterior | interior | both). */
  service_scope?: string;
};

export type ListActiveStationsResult = {
  rows: StationWithAvailableSlots[];
  total: number;
};

/** Row returned by listActiveStations: station columns plus available_slots and completed_count (bigint from DB). */
export type StationWithAvailableSlots = Station & { available_slots: string; completed_count: string };

type StationStatus = 'pending_admin_validation' | 'active' | 'rejected' | 'suspended';


// %%%%% END - Types %%%%%


// %%%%% SQL expressions %%%%%

/** Sum of (capacity - booked_count) for future slots. */
const availableSlotsExpr = sql`(SELECT COALESCE(SUM(${timeSlots.capacity} - ${timeSlots.booked_count}), 0)::bigint FROM time_slots WHERE time_slots.station_id = ${stations.id} AND time_slots.start_time > NOW())`;

/**
 * Count of reservations with completed_at IS NOT NULL per station (for most_visited and sort).
 * This is the "Services terminés" metric per plan Section 4.
 */
const completedCountExpr = sql`(SELECT COUNT(*)::bigint FROM reservations WHERE reservations.station_id = ${stations.id} AND reservations.completed_at IS NOT NULL)`;


// %%%%% END - SQL expressions %%%%%


// %%%%% Internal helpers %%%%%

function rowToStationWithSlots(
  row: Station & { available_slots: unknown; completed_count: unknown }
): StationWithAvailableSlots {
  return {
    ...row,
    available_slots: String(row.available_slots),
    completed_count: String(row.completed_count),
  };
}

/**
 * Builds WHERE conditions for listActiveStations and listActiveStationsCount.
 * Shared so count and list use identical filters.
 * When washTypeIds is non-empty, restricts to stations that have at least one matching row in station_wash_types.
 * When serviceScope is provided, restricts to stations where service_scope equals that value.
 */
function listActiveStationsWhere(
  search: string | undefined,
  city: string | undefined,
  formatId: string | undefined,
  washTypeIds: string[] | undefined,
  serviceScope: string | undefined
) {
  const conditions = [eq(stations.status, 'active')];

  if (city) conditions.push(eq(stations.city, city));

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(stations.name, term),
        ilike(stations.address, term),
        ilike(stations.city, term),
        ilike(stations.description, term)
      )!
    );
  }

  if (formatId) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM vehicle_formats WHERE vehicle_formats.station_id = ${stations.id} AND vehicle_formats.id = ${formatId})`
    );
  }

  if (washTypeIds?.length) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${stationWashTypes} WHERE ${stationWashTypes.station_id} = ${stations.id} AND ${inArray(stationWashTypes.wash_type_id, washTypeIds)})`
    );
  }

  if (serviceScope) {
    conditions.push(eq(stations.service_scope, serviceScope));
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

/**
 * Search prioritization: order by match type (name > address/city > description).
 * Used only when search term is present.
 */
function searchPriorityOrder(term: string) {
  return sql`CASE
    WHEN ${stations.name} ILIKE ${term} THEN 1
    WHEN ${stations.address} ILIKE ${term} OR ${stations.city} ILIKE ${term} THEN 2
    WHEN ${stations.description} ILIKE ${term} THEN 3
    ELSE 4
  END`;
}

/**
 * Builds ORDER BY list from sort criteria (priority order).
 */
function buildOrderBy(sort: StationSortCriterion[] | undefined, searchTerm: string | undefined) {
  const orderByList: ReturnType<typeof asc>[] = [];

  if (searchTerm && !sort?.length) {
    orderByList.push(asc(searchPriorityOrder(`%${searchTerm}%`)));
  }

  if (sort?.length) {
    for (const c of sort) {
      if (c === 'slots_asc') orderByList.push(asc(availableSlotsExpr));
      else if (c === 'slots_desc') orderByList.push(desc(availableSlotsExpr));
      else if (c === 'name_asc') orderByList.push(asc(stations.name));
      else if (c === 'name_desc') orderByList.push(desc(stations.name));
      else if (c === 'rating_asc') orderByList.push(asc(stations.average_score));
      else if (c === 'rating_desc') orderByList.push(desc(stations.average_score));
      else if (c === 'total_ratings_asc') orderByList.push(asc(stations.total_ratings));
      else if (c === 'total_ratings_desc') orderByList.push(desc(stations.total_ratings));
      else if (c === 'completed_count_asc') orderByList.push(asc(completedCountExpr));
      else if (c === 'completed_count_desc') orderByList.push(desc(completedCountExpr));
    }
  }

  return orderByList;
}


// %%%%% END - Internal helpers %%%%%


// %%%%% Single-record queries %%%%%

/**
 * Inserts a new station row and returns it.
 */
export async function createStation(data: NewStation): Promise<Station> {
  const [station] = await db.insert(stations).values(data).returning();
  return station;
}

/**
 * Finds a station by primary key. Returns undefined if not found.
 */
export async function findStationById(id: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.id, id) });
}

/**
 * Finds the station associated with a user account. Returns undefined if not found.
 */
export async function findStationByUserId(userId: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.user_id, userId) });
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

/**
 * Returns the number of reservations with completed_at IS NOT NULL for a station.
 * Same predicate as completedCountExpr (Services terminés). Used for station detail.
 */
export async function getCompletedCountForStation(stationId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .where(and(eq(reservations.station_id, stationId), isNotNull(reservations.completed_at)));
  return rows[0]?.count ?? 0;
}


// %%%%% END - Single-record queries %%%%%


// %%%%% List queries %%%%%

/**
 * Lists stations with status 'active', optional search (name/address/city/description with prioritization),
 * city filter, format_id filter, service_scope filter, multi-criteria sort, and pagination.
 * Each row includes available_slots and completed_count.
 */
export async function listActiveStations(
  filters: ListActiveStationsFilters = {}
): Promise<ListActiveStationsResult> {
  const { search, city, sort, page = 1, per_page = 20, format_id, wash_type_ids, service_scope } = filters;
  const searchTerm = search?.trim();
  const whereClause = listActiveStationsWhere(search, city, format_id, wash_type_ids, service_scope);

  const limit = Math.min(Math.max(1, per_page ?? 20), 100);
  const offset = (Math.max(1, page ?? 1) - 1) * limit;
  const orderByList = buildOrderBy(sort, searchTerm);

  const baseSelect = db
    .select({
      ...getTableColumns(stations),
      available_slots: availableSlotsExpr.as('available_slots'),
      completed_count: completedCountExpr.as('completed_count'),
    })
    .from(stations)
    .where(whereClause);

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(stations).where(whereClause),
    orderByList.length > 0
      ? baseSelect.orderBy(...orderByList).limit(limit).offset(offset)
      : baseSelect.limit(limit).offset(offset),
  ]);

  const total = countRows[0]?.count ?? 0;
  return { rows: rows.map(rowToStationWithSlots), total };
}

/**
 * Lists stations for a single group (same filters as listActiveStations, different order/limit).
 * Used to fill data.available_now, data.most_appreciated, data.most_visited.
 */
export async function listActiveStationsGroup(
  group: 'available_now' | 'most_appreciated' | 'most_visited',
  filters: ListActiveStationsFilters,
  limitPerGroup: number
): Promise<StationWithAvailableSlots[]> {
  const { search, city, sort, format_id, wash_type_ids, service_scope } = filters;
  const searchTerm = search?.trim();
  const whereClause = listActiveStationsWhere(search, city, format_id, wash_type_ids, service_scope);

  const groupOrder: StationSortCriterion[] =
    group === 'available_now'
      ? ['slots_desc', ...(sort ?? [])]
      : group === 'most_appreciated'
        ? ['rating_desc', ...(sort ?? [])]
        : ['completed_count_desc', ...(sort ?? [])];

  const orderByList = buildOrderBy(groupOrder.length ? groupOrder : undefined, searchTerm);

  const baseSelect = () =>
    db
      .select({
        ...getTableColumns(stations),
        available_slots: availableSlotsExpr.as('available_slots'),
        completed_count: completedCountExpr.as('completed_count'),
      })
      .from(stations)
      .where(group === 'available_now' ? and(whereClause, sql`(${availableSlotsExpr}) > 0`) : whereClause);

  const query = baseSelect();
  const ordered = orderByList.length > 0 ? query.orderBy(...orderByList) : query;
  const rawRows = await ordered.limit(limitPerGroup);
  return rawRows.map(rowToStationWithSlots);
}

/**
 * Returns a paginated list of stations filtered by status.
 */
export async function listStationsByStatus(
  status: StationStatus,
  page = 1,
  perPage = 20
): Promise<{ rows: Station[]; total: number }> {
  const offset = (page - 1) * perPage;
  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(stations)
      .where(eq(stations.status, status))
      .orderBy(asc(stations.created_at))
      .limit(perPage)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(stations)
      .where(eq(stations.status, status)),
  ]);
  return { rows, total: countResult[0]?.count ?? 0 };
}

/**
 * List all stations for admin KYC history, optionally filtered by status.
 * Ordered by updated_at DESC so most recent activity appears first.
 */
export async function listAllStationsForAdmin(status?: string): Promise<Station[]> {
  return db.query.stations.findMany({
    where: status ? eq(stations.status, status) : undefined,
    orderBy: (t, { desc }) => [desc(t.updated_at)],
  });
}


// %%%%% END - List queries %%%%%


// %%%%% Mutation queries %%%%%

/**
 * Conditionally updates a station's status. Extra fields (approved_by, approved_at, etc.)
 * can be provided via the optional `extra` argument.
 * Throws if the station row is not found after the update.
 */
export async function updateStationStatus(
  id: string,
  status: StationStatus,
  extra?: Partial<Pick<Station, 'approved_by' | 'approved_at' | 'rejection_reason' | 'rejection_count'>>
): Promise<Station> {
  const [updated] = await db
    .update(stations)
    .set({ status, updated_at: new Date(), ...extra })
    .where(eq(stations.id, id))
    .returning();
  if (!updated) throw new Error(`Station ${id} not found during status update`);
  return updated;
}

/**
 * Partially updates station profile fields. Returns undefined if the station is not found.
 */
export async function updateStationInfo(
  id: string,
  data: Partial<NewStation>
): Promise<Station | undefined> {
  const [updated] = await db
    .update(stations)
    .set({ ...data, updated_at: new Date() })
    .where(eq(stations.id, id))
    .returning();
  return updated;
}


// %%%%% END - Mutation queries %%%%%
