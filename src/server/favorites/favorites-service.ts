/**
 * Business logic for user favorites (saved stations).
 */
import { ConflictError, NotFoundError } from '@/lib/errors';
import { findStationById } from '@/server/station/station-repository';
import {
  addFavorite,
  hasFavorite,
  listFavoritesByUser,
  removeFavorite,
  type Favorite,
  type FavoriteStationRow,
} from './favorites-repository';


/**
 * Adds a station to the user's favorites.
 * Throws NotFoundError if station does not exist or is not active (clients should not
 * be able to favorite suspended / pending / rejected stations they cannot transact with).
 * Throws ConflictError if already favorited.
 */
export async function addToFavorites(userId: string, stationId: string): Promise<Favorite> {
  const station = await findStationById(stationId);
  if (!station || station.status !== 'active') throw new NotFoundError('Station not found');

  const existing = await hasFavorite(userId, stationId);
  if (existing) throw new ConflictError('Station already in favorites');

  const row = await addFavorite(userId, stationId);
  if (!row) throw new ConflictError('Station already in favorites');
  return row;
}

/**
 * Removes a station from the user's favorites.
 * Throws NotFoundError if the favorite does not exist.
 */
export async function removeFromFavorites(userId: string, stationId: string): Promise<void> {
  const deleted = await removeFavorite(userId, stationId);
  if (!deleted) throw new NotFoundError('Favorite not found');
}

/**
 * Returns a paginated list of the user's favorited stations.
 */
export async function getMyFavorites(
  userId: string,
  page: number,
  perPage: number
): Promise<{ items: FavoriteStationRow[]; total: number; page: number; per_page: number }> {
  const { items, total } = await listFavoritesByUser(userId, page, perPage);
  return { items, total, page, per_page: perPage };
}
