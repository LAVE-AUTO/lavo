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


// ─── Create / delete ─────────────────────────────────────────────────────────

type InsertUserInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  password_hash: string;
  role: 'admin' | 'client' | 'station';
  status: string;
  force_password_change: boolean;
  email_verified_at: Date | null;
};

/**
 * Inserts a new user row and returns the safe (no password_hash) record.
 *
 * @param data - Full user insert payload including the pre-hashed password.
 * @returns The newly created user with password_hash stripped.
 */
export async function insertUser(data: InsertUserInput): Promise<AdminSafeUser> {
  const [created] = await db.insert(users).values(data).returning();
  return stripPasswordHash(created);
}

/**
 * Permanently deletes a user by id.
 * Cascade deletes apply to child tables (reservations FK: restrict/cascade depending on schema).
 *
 * @param id - UUID of the user to delete.
 */
export async function hardDeleteUserById(id: string): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

type InsertStationInput = {
  user_id: string;
  name: string;
  legal_name?: string | null;
  address: string;
  city: string;
  service_scope?: string | null;
  description?: string | null;
  status: string;
  is_open: boolean;
  approved_at: Date;
  approved_by: string;
};

/**
 * Inserts a new station row and returns the full record.
 *
 * @param data - Full station insert payload.
 * @returns The newly created station record.
 */
export async function insertStation(data: InsertStationInput): Promise<AdminStation> {
  const [created] = await db.insert(stations).values(data).returning();
  return {
    ...created,
    promo_commission_rate: created.promo_commission_rate == null ? null : String(created.promo_commission_rate),
    latitude: created.latitude == null ? null : String(created.latitude),
    longitude: created.longitude == null ? null : String(created.longitude),
    average_score: created.average_score == null ? null : String(created.average_score),
  } as AdminStation;
}

/**
 * Permanently deletes a station by id (cascade deletes child rows).
 *
 * @param id - UUID of the station to delete.
 */
export async function hardDeleteStationById(id: string): Promise<void> {
  await db.delete(stations).where(eq(stations.id, id));
}


// ─── Admin profile ────────────────────────────────────────────────────────────

/**
 * Finds a user where role = 'admin' by id.
 * Returns undefined if not found or not an admin.
 *
 * @param id - UUID of the admin user.
 */
export async function findAdminById(id: string): Promise<AdminSafeUser | undefined> {
  const row = await db.query.users.findFirst({
    where: and(eq(users.id, id), eq(users.role, 'admin')),
  });
  return row ? stripPasswordHash(row) : undefined;
}

type UpdateAdminInput = {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  email?: string;
  password_hash?: string;
};

/**
 * Updates whitelisted admin fields and returns the updated safe record.
 * Returns undefined if the user was not found.
 *
 * @param id     - UUID of the admin to update.
 * @param fields - Fields to update (only whitelisted ones).
 */
export async function updateAdminById(
  id: string,
  fields: UpdateAdminInput
): Promise<AdminSafeUser | undefined> {
  const [updated] = await db
    .update(users)
    .set({ ...fields, updated_at: new Date() })
    .where(and(eq(users.id, id), eq(users.role, 'admin')))
    .returning();
  return updated ? stripPasswordHash(updated) : undefined;
}

/**
 * Looks up a user by email address.
 * Used to check for email uniqueness before creation or update.
 *
 * @param email - The email address to search for.
 * @returns The user row (with password_hash) or undefined if not found.
 */
export async function findUserByEmail(email: string): Promise<typeof users.$inferSelect | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

/**
 * Looks up a user by id, including the password_hash column.
 * Use ONLY for password verification — never return this to clients.
 *
 * @param id - UUID of the user.
 */
export async function findUserWithPasswordById(id: string): Promise<typeof users.$inferSelect | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}
