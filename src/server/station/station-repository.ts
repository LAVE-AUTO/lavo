import { and, asc, desc, eq, getTableColumns, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { reservations, stationHours, stationStats, stationWashTypes, stations, timeSlots } from '@/lib/db/schema';
import type { StationSortCriterion } from '@/helpers/sort-stations';

export type Station = typeof stations.$inferSelect;
export type NewStation = typeof stations.$inferInsert;

/**
 * Precomputed available_slots from station_stats LEFT JOIN.
 * COALESCE handles stations that have no row in the view yet (e.g. first run before refresh).
 */
const availableSlotsExpr = sql<number>`COALESCE(${stationStats.available_slots}, 0)`;

/**
 * Precomputed completed_count from station_stats LEFT JOIN.
 * This is the "Services terminés" metric per plan Section 4.
 */
const completedCountExpr = sql<number>`COALESCE(${stationStats.completed_count}, 0)`;

/** Lowest active service entry price for the station, as text (nullable when no entries). */
const priceFromExpr = sql<string | null>`(SELECT MIN(sve.price)::text FROM service_vehicle_entries sve JOIN station_services ss ON ss.id = sve.service_id WHERE ss.station_id = ${stations.id} AND ss.deleted_at IS NULL AND sve.is_active = true)`;

/** URL of the first station photo ordered by position (nullable when no photos). */
const imageUrlExpr = sql<string | null>`(SELECT station_photos.url FROM station_photos WHERE station_photos.station_id = ${stations.id} ORDER BY station_photos.position ASC LIMIT 1)`;

/** Count of live queue entries (pending_payment, pending, confirmed, late) for the station. */
const liveQueueCountExpr = sql<number>`(SELECT COUNT(*)::int FROM reservations WHERE reservations.station_id = ${stations.id} AND reservations.entry_type = 'queue' AND reservations.status IN ('pending_payment', 'pending', 'confirmed', 'late'))`;

/** Station opening time from station_configs (nullable when config absent). */
const openingTimeExpr = sql<string | null>`(SELECT station_configs.opening_time::text FROM station_configs WHERE station_configs.id = ${stations.id})`;

/** Station closing time from station_configs (nullable when config absent). */
const closingTimeExpr = sql<string | null>`(SELECT station_configs.closing_time::text FROM station_configs WHERE station_configs.id = ${stations.id})`;

/** Minimum service duration (min) across all active service entries for the station. Null when no services configured. */
const minDurationExpr = sql<number | null>`(SELECT MIN(sve.duration_min) FROM service_vehicle_entries sve JOIN station_services ss ON ss.id = sve.service_id WHERE ss.station_id = ${stations.id} AND ss.deleted_at IS NULL AND sve.is_active = true)`;

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
  /** User latitude in degrees; required (with near_lng) to support `distance_asc`/`distance_desc` sort. */
  near_lat?: number;
  /** User longitude in degrees; required (with near_lat) to support `distance_asc`/`distance_desc` sort. */
  near_lng?: number;
  /** When true, restricts to stations with is_open=true for today's day_of_week in station_hours. */
  open_today?: boolean;
};

/**
 * Squared great-circle distance approximation (no sqrt) suitable for ordering.
 * Returns infinity when the station has no lat/lng so it sorts to the end.
 * `near_lat` and `near_lng` are passed as plain numbers and parameterised via Drizzle.
 *
 * Implementation: equirectangular projection. Accurate enough at the city
 * scale we care about and avoids requiring the PostGIS extension.
 */
function distanceOrderExpr(nearLat: number, nearLng: number) {
  return sql<number>`(
    CASE
      WHEN ${stations.latitude} IS NULL OR ${stations.longitude} IS NULL THEN 1e18
      ELSE
        POWER(((${stations.latitude})::float - ${nearLat}::float) * 111.0, 2)
        + POWER(((${stations.longitude})::float - ${nearLng}::float) * 111.0 * COS(RADIANS(${nearLat}::float)), 2)
    END
  )`;
}

/** Haversine distance in km between station and user. Returns NULL when station has no coordinates. */
function distanceKmExpr(nearLat: number, nearLng: number) {
  return sql<number | null>`(
    CASE
      WHEN ${stations.latitude} IS NULL OR ${stations.longitude} IS NULL THEN NULL
      ELSE 2 * 6371.0 * ASIN(SQRT(
        POWER(SIN(RADIANS(((${stations.latitude})::float - ${nearLat}::float) / 2)), 2)
        + COS(RADIANS(${nearLat}::float)) * COS(RADIANS((${stations.latitude})::float))
          * POWER(SIN(RADIANS(((${stations.longitude})::float - ${nearLng}::float) / 2)), 2)
      ))
    END
  )`;
}

export type ListActiveStationsResult = {
  rows: StationWithAvailableSlots[];
  total: number;
};

/** Row returned by listActiveStations: station columns plus computed metrics and enriched fields. */
export type StationWithAvailableSlots = Station & {
  available_slots: string;
  completed_count: string;
  price_from: string | null;
  image_url: string | null;
  live_queue_count: number;
  opening_time: string | null;
  closing_time: string | null;
  min_duration: number | null;
  distance_km: number | null;
};

type StationEnrichedRow = Station & {
  available_slots: unknown;
  completed_count: unknown;
  price_from: string | null;
  image_url: string | null;
  live_queue_count: number;
  opening_time: string | null;
  closing_time: string | null;
  min_duration: number | null;
  distance_km: number | null;
};

function rowToStationWithSlots(row: StationEnrichedRow): StationWithAvailableSlots {
  return {
    ...row,
    available_slots: String(row.available_slots),
    completed_count: String(row.completed_count),
  };
}

export async function createStation(data: NewStation): Promise<Station> {
  const [station] = await db.insert(stations).values(data).returning();
  return station;
}

export async function findStationById(id: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.id, id) });
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
  serviceScope: string | undefined,
  openToday?: boolean
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
      sql`EXISTS (SELECT 1 FROM service_vehicle_entries sve JOIN station_services ss ON ss.id = sve.service_id WHERE ss.station_id = ${stations.id} AND ss.deleted_at IS NULL AND sve.vehicle_format_id = ${formatId})`
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
  if (openToday) {
    const todayDow = new Date().getDay();
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${stationHours} WHERE ${stationHours.station_id} = ${stations.id} AND ${stationHours.day_of_week} = ${todayDow} AND ${stationHours.is_open} = true)`
    );
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
 *
 * `nearLat` / `nearLng` are required to honour the `distance_asc` /
 * `distance_desc` criteria; when missing those tokens are silently skipped so
 * the rest of the sort still applies.
 */
function buildOrderBy(
  sort: StationSortCriterion[] | undefined,
  searchTerm: string | undefined,
  nearLat?: number,
  nearLng?: number,
) {
  const orderByList: ReturnType<typeof asc>[] = [];
  if (searchTerm && sort?.length === 0) {
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
      else if (c === 'distance_asc' && nearLat != null && nearLng != null) {
        orderByList.push(asc(distanceOrderExpr(nearLat, nearLng)));
      }
      else if (c === 'distance_desc' && nearLat != null && nearLng != null) {
        orderByList.push(desc(distanceOrderExpr(nearLat, nearLng)));
      }
    }
  }
  return orderByList;
}

/**
 * Lists stations with status 'active', optional search (name/address/city/description with prioritization),
 * city filter, format_id filter, service_scope filter, multi-criteria sort, and pagination.
 * Each row includes available_slots and completed_count.
 */
export async function listActiveStations(
  filters: ListActiveStationsFilters = {}
): Promise<ListActiveStationsResult> {
  const { search, city, sort, page = 1, per_page = 20, format_id, wash_type_ids, service_scope, near_lat, near_lng, open_today } = filters;
  const searchTerm = search?.trim();
  const whereClause = listActiveStationsWhere(search, city, format_id, wash_type_ids, service_scope, open_today);

  const limit = Math.min(Math.max(1, per_page ?? 20), 100);
  const offset = (Math.max(1, page ?? 1) - 1) * limit;

  const orderByList = buildOrderBy(sort, searchTerm, near_lat, near_lng);

  const distKm = (near_lat != null && near_lng != null)
    ? distanceKmExpr(near_lat, near_lng).as('distance_km')
    : sql<null>`NULL::float`.as('distance_km');

  const baseSelect = db
    .select({
      ...getTableColumns(stations),
      available_slots: availableSlotsExpr.as('available_slots'),
      completed_count: completedCountExpr.as('completed_count'),
      price_from: priceFromExpr.as('price_from'),
      image_url: imageUrlExpr.as('image_url'),
      live_queue_count: liveQueueCountExpr.as('live_queue_count'),
      opening_time: openingTimeExpr.as('opening_time'),
      closing_time: closingTimeExpr.as('closing_time'),
      min_duration: minDurationExpr.as('min_duration'),
      distance_km: distKm,
    })
    .from(stations)
    .leftJoin(stationStats, eq(stationStats.station_id, stations.id))
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
  const { search, city, sort, format_id, wash_type_ids, service_scope, near_lat, near_lng, open_today } = filters;
  const searchTerm = search?.trim();
  const whereClause = listActiveStationsWhere(search, city, format_id, wash_type_ids, service_scope, open_today);

  const groupOrder: StationSortCriterion[] =
    group === 'available_now'
      ? ['slots_desc', ...(sort ?? [])]
      : group === 'most_appreciated'
        ? ['rating_desc', ...(sort ?? [])]
        : ['completed_count_desc', ...(sort ?? [])];

  const orderByList = buildOrderBy(groupOrder.length ? groupOrder : undefined, searchTerm, near_lat, near_lng);

  const distKm = (near_lat != null && near_lng != null)
    ? distanceKmExpr(near_lat, near_lng).as('distance_km')
    : sql<null>`NULL::float`.as('distance_km');

  const baseSelect = () =>
    db
      .select({
        ...getTableColumns(stations),
        available_slots: availableSlotsExpr.as('available_slots'),
        completed_count: completedCountExpr.as('completed_count'),
        price_from: priceFromExpr.as('price_from'),
        image_url: imageUrlExpr.as('image_url'),
        live_queue_count: liveQueueCountExpr.as('live_queue_count'),
        opening_time: openingTimeExpr.as('opening_time'),
        closing_time: closingTimeExpr.as('closing_time'),
        min_duration: minDurationExpr.as('min_duration'),
        distance_km: distKm,
      })
      .from(stations)
      .leftJoin(stationStats, eq(stationStats.station_id, stations.id))
      .where(group === 'available_now' ? and(whereClause, sql`COALESCE(${stationStats.available_slots}, 0) > 0`) : whereClause);

  const query = baseSelect();
  const ordered = orderByList.length > 0 ? query.orderBy(...orderByList) : query;
  const rawRows = await ordered.limit(limitPerGroup);
  return rawRows.map(rowToStationWithSlots);
}

/**
 * Finds an active station by id with config, vehicle formats, time slots, photos, and wash types.
 * Returns undefined if not found or station is not active.
 */
export async function findActiveStationWithDetail(id: string) {
  return db.query.stations.findFirst({
    where: and(eq(stations.id, id), eq(stations.status, 'active')),
    with: {
      stationConfig: true,
      timeSlots: true,
      photos: {
        orderBy: (photo, { asc }) => [asc(photo.position)],
      },
      stationWashTypes: {
        with: { washType: true },
      },
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

export async function findStationByUserId(userId: string): Promise<Station | undefined> {
  return db.query.stations.findFirst({ where: eq(stations.user_id, userId) });
}

type StationStatus = 'pending_admin_validation' | 'active' | 'rejected' | 'suspended';

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
 *
 * Accepts optional pagination params; defaults to page=1, perPage=500.
 * Hard cap: perPage is clamped to 500 regardless of what is passed.
 * Existing callers that pass no params continue to work unchanged.
 */
export async function listAllStationsForAdmin(
  status?: string,
  page = 1,
  perPage = 500
): Promise<Station[]> {
  const limit = Math.min(Math.floor(perPage), 500);
  const offset = (Math.max(1, Math.floor(page)) - 1) * limit;
  return db.query.stations.findMany({
    where: status ? eq(stations.status, status) : undefined,
    orderBy: (t, { desc }) => [desc(t.updated_at)],
    limit,
    offset,
  });
}

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

export async function updateStationInfo(
  id: string,
  data: Partial<NewStation>
): Promise<Station> {
  const [updated] = await db
    .update(stations)
    .set({ ...data, updated_at: new Date() })
    .where(eq(stations.id, id))
    .returning();
  if (!updated) throw new Error(`Station ${id} not found during info update`);
  return updated;
}

export async function getNotificationPrefs(stationId: string): Promise<Record<string, unknown> | null> {
  const row = await db.query.stations.findFirst({
    where: eq(stations.id, stationId),
    columns: { notification_prefs: true },
  });
  return (row?.notification_prefs as Record<string, unknown> | null) ?? null;
}

/**
 * Hard cap on the merged document size: prevents unbounded JSONB growth from many
 * PATCH calls each contributing distinct keys. Mirrors the per-request cap (50)
 * used by the route validator.
 */
const NOTIFICATION_PREFS_MAX_TOTAL_KEYS = 50;

export async function patchNotificationPrefs(
  stationId: string,
  prefs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const current = await getNotificationPrefs(stationId);
  const merged: Record<string, unknown> = { ...(current ?? {}), ...prefs };

  // If the merged document exceeds the cap, drop the oldest keys (those not present
  // in the new patch). This keeps the JSONB bounded across many PATCH calls.
  const keys = Object.keys(merged);
  if (keys.length > NOTIFICATION_PREFS_MAX_TOTAL_KEYS) {
    const newKeys = new Set(Object.keys(prefs));
    const overflow = keys.length - NOTIFICATION_PREFS_MAX_TOTAL_KEYS;
    let dropped = 0;
    for (const k of keys) {
      if (dropped >= overflow) break;
      if (!newKeys.has(k)) {
        delete merged[k];
        dropped++;
      }
    }
  }

  await db.update(stations).set({ notification_prefs: merged, updated_at: new Date() }).where(eq(stations.id, stationId));
  return merged;
}
