/**
 * Aggregates all personal data belonging to a user for RGPD/Law 25 portability export.
 * Excludes internal/operational fields (password_hash, stripe IDs, internal tokens).
 */
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  users,
  reservations,
  ratings,
  favorites,
  noShowFees,
  supportTickets,
  stations,
} from '@/lib/db/schema';

export async function getFullUserData(userId: string) {
  const [
    user,
    userReservations,
    userRatings,
    userFavorites,
    userFees,
    userTickets,
  ] = await Promise.all([
    db
      .select({
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
        phone: users.phone,
        role: users.role,
        status: users.status,
        created_at: users.created_at,
        updated_at: users.updated_at,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),

    db
      .select({
        entry_type: reservations.entry_type,
        status: reservations.status,
        station_name: stations.name,
        amount_paid: reservations.amount_paid,
        commission_amount: reservations.commission_amount,
        tip_amount: reservations.tip_amount,
        created_at: reservations.created_at,
      })
      .from(reservations)
      .leftJoin(stations, eq(reservations.station_id, stations.id))
      .where(eq(reservations.user_id, userId))
      .orderBy(reservations.created_at),

    db
      .select({
        station_name: stations.name,
        score: ratings.score,
        comment: ratings.comment,
        created_at: ratings.created_at,
      })
      .from(ratings)
      .leftJoin(stations, eq(ratings.station_id, stations.id))
      .where(eq(ratings.user_id, userId))
      .orderBy(ratings.created_at),

    db
      .select({
        station_name: stations.name,
        added_at: favorites.created_at,
      })
      .from(favorites)
      .leftJoin(stations, eq(favorites.station_id, stations.id))
      .where(eq(favorites.user_id, userId)),

    db
      .select({
        station_name: stations.name,
        amount: noShowFees.amount,
        reason: noShowFees.reason,
        status: noShowFees.status,
        created_at: noShowFees.created_at,
      })
      .from(noShowFees)
      .leftJoin(stations, eq(noShowFees.station_id, stations.id))
      .where(eq(noShowFees.user_id, userId))
      .orderBy(noShowFees.created_at),

    db
      .select({
        subject: supportTickets.subject,
        status: supportTickets.status,
        created_at: supportTickets.created_at,
      })
      .from(supportTickets)
      .where(eq(supportTickets.created_by, userId))
      .orderBy(supportTickets.created_at),
  ]);

  const profile = user[0];
  if (!profile) throw new Error('User not found');

  return {
    exported_at: new Date().toISOString(),
    profile,
    reservations: userReservations,
    ratings: userRatings,
    favorites: userFavorites,
    no_show_fees: userFees,
    support_tickets: userTickets,
  };
}
