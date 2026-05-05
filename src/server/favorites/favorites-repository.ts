/**
 * Data access for user favorites (saved stations).
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { favorites, stations } from '@/lib/db/schema';

export type Favorite = typeof favorites.$inferSelect;


/**
 * Returns true if the user has already favorited this station.
 */
export async function hasFavorite(userId: string, stationId: string): Promise<boolean> {
  const row = await db.query.favorites.findFirst({
    where: and(eq(favorites.user_id, userId), eq(favorites.station_id, stationId)),
  });
  return row !== undefined;
}

/**
 * Adds a station to the user's favorites. No-op on duplicate (ON CONFLICT DO NOTHING).
 * Returns the created row, or undefined if it already existed.
 */
export async function addFavorite(userId: string, stationId: string): Promise<Favorite | undefined> {
  const [row] = await db
    .insert(favorites)
    .values({ user_id: userId, station_id: stationId })
    .onConflictDoNothing()
    .returning();
  return row;
}

/**
 * Removes a station from the user's favorites. Returns true if deleted, false if not found.
 */
export async function removeFavorite(userId: string, stationId: string): Promise<boolean> {
  const rows = await db
    .delete(favorites)
    .where(and(eq(favorites.user_id, userId), eq(favorites.station_id, stationId)))
    .returning({ id: favorites.id });
  return rows.length > 0;
}

export type FavoriteStationRow = {
  id: string;
  name: string;
  address: string;
  city: string;
  status: string;
  average_score: string | null;
  total_ratings: number;
  image_url: string | null;
  favorited_at: Date;
};

/**
 * Lists a user's favorited stations with basic station data, ordered by most recently added.
 */
export async function listFavoritesByUser(
  userId: string,
  page: number,
  perPage: number
): Promise<{ items: FavoriteStationRow[]; total: number }> {
  const limit = Math.min(Math.max(1, perPage), 100);
  const offset = (Math.max(1, page) - 1) * limit;
  const where = eq(favorites.user_id, userId);

  const [countRows, rows] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(favorites).where(where),
    db
      .select({
        id: stations.id,
        name: stations.name,
        address: stations.address,
        city: stations.city,
        status: stations.status,
        average_score: stations.average_score,
        total_ratings: stations.total_ratings,
        image_url: sql<string | null>`(SELECT sp.url FROM station_photos sp WHERE sp.station_id = ${stations.id} ORDER BY sp.position ASC LIMIT 1)`,
        favorited_at: favorites.created_at,
      })
      .from(favorites)
      .innerJoin(stations, eq(favorites.station_id, stations.id))
      .where(where)
      .orderBy(desc(favorites.created_at))
      .limit(limit)
      .offset(offset),
  ]);

  return { items: rows, total: countRows[0]?.count ?? 0 };
}
