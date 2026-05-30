/**
 * Data access for ratings. One rating per completed reservation; admin moderation via visibility toggle.
 */
import { and, asc, desc, eq, gte, ilike, inArray, lte, sql } from 'drizzle-orm';
import { db, type DbTransaction } from '@/lib/db';
import { adminLogs, ratings, stations, users } from '@/lib/db/schema';


// %%%%% Type exports %%%%%
// Rating row type

export type Rating = typeof ratings.$inferSelect;


// %%%%% Rating CRUD %%%%%
// Insert, find, and update rating records

/**
 * Inserts a new rating record.
 */
export async function insertRating(
  data: {
    reservation_id: string;
    user_id: string;
    station_id: string;
    score: number;
    comment?: string | null;
  },
  tx?: DbTransaction
): Promise<Rating> {
  const client = tx ?? db;
  const [row] = await client
    .insert(ratings)
    .values({
      reservation_id: data.reservation_id,
      user_id: data.user_id,
      station_id: data.station_id,
      score: data.score,
      comment: data.comment ?? null,
    })
    .returning();
  if (!row) throw new Error('Insert rating failed');
  return row;
}

/**
 * Finds a rating by reservation id.
 */
export async function findRatingByReservationId(
  reservationId: string
): Promise<Rating | undefined> {
  return db.query.ratings.findFirst({
    where: eq(ratings.reservation_id, reservationId),
  });
}

/**
 * Finds a rating by id.
 */
export async function findRatingById(
  ratingId: string,
  tx?: DbTransaction
): Promise<Rating | undefined> {
  const client = tx ?? db;
  return client.query.ratings.findFirst({
    where: eq(ratings.id, ratingId),
  });
}

/**
 * Updates a rating's visibility (is_visible). Used for admin moderation.
 */
export async function updateRatingVisibility(
  ratingId: string,
  isVisible: boolean,
  tx?: DbTransaction
): Promise<Rating> {
  const client = tx ?? db;
  const [row] = await client
    .update(ratings)
    .set({ is_visible: isVisible })
    .where(eq(ratings.id, ratingId))
    .returning();
  if (!row) throw new Error('Update rating visibility failed');
  return row;
}



// %%%%% Station aggregation %%%%%
// Recompute station-level rating stats from visible ratings

/**
 * Recomputes average_score and total_ratings for a station from visible ratings only.
 * Must be called inside a transaction for consistency.
 */
export async function recalcStationRating(
  stationId: string,
  tx?: DbTransaction
): Promise<void> {
  const client = tx ?? db;
  await client
    .update(stations)
    .set({
      average_score: sql`(SELECT AVG(score)::decimal(3,2) FROM ratings WHERE station_id = ${stationId} AND is_visible = true)`,
      total_ratings: sql`(SELECT COUNT(*)::int FROM ratings WHERE station_id = ${stationId} AND is_visible = true)`,
    })
    .where(eq(stations.id, stationId));
}


// %%%%% Public ratings listing %%%%%
// Visible ratings for public display

export type PublicRatingItem = Pick<Rating, 'id' | 'score' | 'comment' | 'created_at'> & {
  author_first_name: string | null;
};

/**
 * Lists public (visible) ratings for a station, paginated and ordered by recency.
 * Includes author_first_name from a LEFT JOIN on users.
 */
export async function listPublicRatingsByStation(
  stationId: string,
  page: number,
  limit: number
): Promise<{ items: PublicRatingItem[]; total: number }> {
  const offset = (page - 1) * limit;
  const where = and(eq(ratings.station_id, stationId), eq(ratings.is_visible, true));

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(ratings).where(where),
    db
      .select({
        id: ratings.id,
        score: ratings.score,
        comment: ratings.comment,
        created_at: ratings.created_at,
        author_first_name: users.first_name,
      })
      .from(ratings)
      .leftJoin(users, eq(ratings.user_id, users.id))
      .where(where)
      .orderBy(desc(ratings.created_at))
      .limit(limit)
      .offset(offset),
  ]);

  return { items: rows, total: countRows[0]?.count ?? 0 };
}


// %%%%% User ratings listing %%%%%
// Ratings submitted by a specific user

export type UserRatingItem = Pick<Rating, 'id' | 'score' | 'comment' | 'created_at'> & {
  station: { id: string; name: string };
};

/**
 * Lists ratings submitted by a user, paginated and ordered by recency.
 * Includes station id and name from a LEFT JOIN on stations.
 */
export async function listRatingsByUser(
  userId: string,
  page: number,
  limit: number
): Promise<{ items: UserRatingItem[]; total: number }> {
  const offset = (page - 1) * limit;
  const where = eq(ratings.user_id, userId);

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(ratings).where(where),
    db
      .select({
        id: ratings.id,
        score: ratings.score,
        comment: ratings.comment,
        created_at: ratings.created_at,
        station_id: ratings.station_id,
        station_name: stations.name,
      })
      .from(ratings)
      .leftJoin(stations, eq(ratings.station_id, stations.id))
      .where(where)
      .orderBy(desc(ratings.created_at))
      .limit(limit)
      .offset(offset),
  ]);

  const items: UserRatingItem[] = rows.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    created_at: r.created_at,
    station: { id: r.station_id, name: r.station_name ?? '' },
  }));

  return { items, total: countRows[0]?.count ?? 0 };
}


// %%%%% Admin ratings management %%%%%
// Admin listing with filters, sorting, and user/station details

export type AdminRatingItem = {
  id: string;
  score: number;
  comment: string | null;
  is_visible: boolean;
  created_at: Date;
  reservation_id: string;
  user: { id: string; first_name: string | null; last_name: string | null };
  station: { id: string; name: string };
};

export type AdminRatingsFilters = {
  station_id?: string;
  station_name?: string;
  is_visible?: boolean;
  score_min?: number;
  score_max?: number;
  from?: string;
  to?: string;
  sort_by: 'created_at' | 'score';
  sort_order: 'asc' | 'desc';
  page: number;
  limit: number;
};

/**
 * Lists all ratings with admin filters (station, visibility, score range, date range, sort, pagination).
 * Includes user and station detail data.
 */
export async function listAdminRatings(
  filters: AdminRatingsFilters
): Promise<{ items: AdminRatingItem[]; total: number }> {
  const { station_id, station_name, is_visible, score_min, score_max, from, to, sort_by, sort_order, page, limit } = filters;
  const offset = (page - 1) * limit;

  const conditions = [];
  if (station_id !== undefined) conditions.push(eq(ratings.station_id, station_id));
  if (station_name !== undefined && station_name.trim() !== '') {
    const trimmed = station_name.trim();
    conditions.push(
      inArray(
        ratings.station_id,
        db.select({ id: stations.id }).from(stations).where(ilike(stations.name, `%${trimmed}%`)),
      ),
    );
  }
  if (is_visible !== undefined) conditions.push(eq(ratings.is_visible, is_visible));
  if (score_min !== undefined) conditions.push(gte(ratings.score, score_min));
  if (score_max !== undefined) conditions.push(lte(ratings.score, score_max));
  if (from !== undefined) conditions.push(gte(ratings.created_at, new Date(from + 'T00:00:00.000Z')));
  if (to !== undefined) conditions.push(lte(ratings.created_at, new Date(to + 'T23:59:59.999Z')));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortCol = sort_by === 'score' ? ratings.score : ratings.created_at;
  const orderDir = sort_order === 'asc' ? asc(sortCol) : desc(sortCol);

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(ratings).where(where),
    db
      .select({
        id: ratings.id,
        score: ratings.score,
        comment: ratings.comment,
        is_visible: ratings.is_visible,
        created_at: ratings.created_at,
        reservation_id: ratings.reservation_id,
        user_id: ratings.user_id,
        user_first_name: users.first_name,
        user_last_name: users.last_name,
        station_id: ratings.station_id,
        station_name: stations.name,
      })
      .from(ratings)
      .innerJoin(users, eq(ratings.user_id, users.id))
      .innerJoin(stations, eq(ratings.station_id, stations.id))
      .where(where)
      .orderBy(orderDir)
      .limit(limit)
      .offset(offset),
  ]);

  const items: AdminRatingItem[] = rows.map((r) => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    is_visible: r.is_visible,
    created_at: r.created_at,
    reservation_id: r.reservation_id,
    user: { id: r.user_id, first_name: r.user_first_name, last_name: r.user_last_name },
    station: { id: r.station_id, name: r.station_name },
  }));

  return { items, total: countRows[0]?.count ?? 0 };
}


// %%%%% Admin logging %%%%%
// Audit log for admin actions

/**
 * Inserts an admin audit log entry (used for rating visibility toggle tracking).
 */
export async function insertAdminLog(
  data: {
    admin_id: string;
    action: string;
    target_type: string;
    target_id: string;
    details: Record<string, unknown>;
  },
  tx?: DbTransaction
): Promise<void> {
  const client = tx ?? db;
  await client.insert(adminLogs).values({
    admin_id: data.admin_id,
    action: data.action,
    target_type: data.target_type,
    target_id: data.target_id,
    details: data.details,
  });
}
