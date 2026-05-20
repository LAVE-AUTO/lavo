import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, stations, authRateLimits } from '@/lib/db/schema';
import type { UpdateUserInput, UpdateStationAdminInput } from '@/validators/admin-user';

export type AdminSafeUser = Omit<typeof users.$inferSelect, 'password_hash'>;
export type AdminStation = typeof stations.$inferSelect;

function stripPasswordHash(user: typeof users.$inferSelect): AdminSafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * Lists client-role users with pagination and optional status filter.
 * Returns both the page rows and the total matching count.
 */
export async function listUsersForAdmin(
  status?: string,
  page = 1,
  perPage = 20,
): Promise<{ rows: AdminSafeUser[]; total: number }> {
  const limit  = Math.min(100, Math.max(1, perPage));
  const offset = (Math.max(1, page) - 1) * limit;
  const filter = status
    ? and(eq(users.role, 'client'), eq(users.status, status))
    : eq(users.role, 'client');

  const [rows, countResult] = await Promise.all([
    db.select().from(users).where(filter).orderBy(desc(users.created_at)).limit(limit).offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(users).where(filter),
  ]);

  return { rows: rows.map(stripPasswordHash), total: countResult[0]?.count ?? 0 };
}

/** Finds a user by id. Returns undefined if not found. */
export async function findUserForAdmin(id: string): Promise<AdminSafeUser | undefined> {
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  return user ? stripPasswordHash(user) : undefined;
}

/**
 * Updates whitelisted user fields and returns the updated row.
 * Returns undefined if the user was not found.
 */
export async function updateUserById(
  id: string,
  fields: UpdateUserInput
): Promise<AdminSafeUser | undefined> {
  const [updated] = await db
    .update(users)
    .set({ ...fields, updated_at: new Date() })
    .where(eq(users.id, id))
    .returning();
  return updated ? stripPasswordHash(updated) : undefined;
}

/** Finds a station by id regardless of status. Returns undefined if not found. */
export async function findStationForAdmin(id: string): Promise<AdminStation | undefined> {
  const row = await db.query.stations.findFirst({ where: eq(stations.id, id) });
  if (!row) return undefined;
  // Normalize decimal/numeric fields to JSON-serializable primitives
  return {
    ...row,
    promo_commission_rate: row.promo_commission_rate == null ? null : String(row.promo_commission_rate),
    latitude: row.latitude == null ? null : String(row.latitude),
    longitude: row.longitude == null ? null : String(row.longitude),
    average_score: row.average_score == null ? null : String(row.average_score),
  } as AdminStation;
}

/**
 * Updates whitelisted station fields and returns the updated row.
 * Returns undefined if the station was not found.
 */
export async function updateStationById(
  id: string,
  fields: UpdateStationAdminInput
): Promise<AdminStation | undefined> {
  // decimal columns (latitude, longitude) are stored as strings in Drizzle.
  const { latitude, longitude, ...rest } = fields;
  const dbFields: Partial<typeof stations.$inferInsert> = {
    ...rest,
    ...(latitude !== undefined && { latitude: String(latitude) }),
    ...(longitude !== undefined && { longitude: String(longitude) }),
  };

  const [updated] = await db
    .update(stations)
    .set({ ...dbFields, updated_at: new Date() })
    .where(eq(stations.id, id))
    .returning();
  if (!updated) return undefined;
  return {
    ...updated,
    promo_commission_rate: updated.promo_commission_rate == null ? null : String(updated.promo_commission_rate),
    latitude: updated.latitude == null ? null : String(updated.latitude),
    longitude: updated.longitude == null ? null : String(updated.longitude),
    average_score: updated.average_score == null ? null : String(updated.average_score),
  } as AdminStation;
}

export type UpdateStationPromoQrInput = {
  promo_commission_rate: string | null;
  promo_ref_code: string | null;
  promo_ref_generated_at: Date | null;
};

/** Updates promo QR fields for a station and returns the updated row. */
export async function updateStationPromoQrById(
  id: string,
  fields: UpdateStationPromoQrInput
): Promise<AdminStation | undefined> {
  const [updated] = await db
    .update(stations)
    .set({ ...fields, updated_at: new Date() })
    .where(eq(stations.id, id))
    .returning();
  if (!updated) return undefined;
  return {
    ...updated,
    promo_commission_rate: updated.promo_commission_rate == null ? null : String(updated.promo_commission_rate),
    latitude: updated.latitude == null ? null : String(updated.latitude),
    longitude: updated.longitude == null ? null : String(updated.longitude),
    average_score: updated.average_score == null ? null : String(updated.average_score),
  } as AdminStation;
}

/**
 * Resets the auth rate-limit record keyed by the user's email.
 * No-op if no record exists for that key.
 */
export async function clearRateLimitByEmail(email: string): Promise<void> {
  await db
    .update(authRateLimits)
    .set({ attempts: 0, blocked_until: null, updated_at: new Date() })
    .where(eq(authRateLimits.key, email));
}
