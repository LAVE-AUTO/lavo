import { eq } from 'drizzle-orm';
import { db, type DbTransaction } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getCachedOrFetch, invalidateCache } from '@/lib/redis-cache';

const USER_CACHE_TTL = 300; // 5 min

function userCacheKey(id: string): string {
  return `user:${id}`;
}

export async function invalidateUserCache(userId: string): Promise<void> {
  await invalidateCache(userCacheKey(userId));
}

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type SafeUser = Omit<User, 'password_hash'>;

/**
 * Removes the password hash from a user row
 *
 * Most auth callers should never receive password material once credential
 * checks are finished. This helper centralizes that sanitization so repository
 * methods can return a safe user shape without duplicating field stripping logic.
 *
 * @param {User} user - Raw user row including the `password_hash` column
 * @returns {SafeUser} User object without the `password_hash` field
 * @throws {None} This function does not throw under normal runtime conditions
 *
 * @example
 * const safe = stripPasswordHash(user);
 *
 * @example
 * const safe = stripPasswordHash(user);
 * console.log('password_hash' in safe); // false
 *
 * @example
 * const safe = stripPasswordHash(user);
 * console.log(safe.email);
 */
function stripPasswordHash(user: User): SafeUser {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password_hash, ...safe } = user;
  return safe;
}

/**
 * Finds a user by email address
 *
 * Returns the raw database row, including the password hash, because this
 * lookup is primarily used by credential validation and account lifecycle
 * flows that still need full auth material.
 *
 * @param {string} email - Exact email address to search for
 * @returns {Promise<User | undefined>} Matching user row, or `undefined` when no account uses that email
 * @throws {Error} Propagates database errors from the underlying query
 *
 * @example
 * const user = await findByEmail('jane@example.com');
 *
 * @example
 * if (!(await findByEmail('missing@example.com'))) {
 *   console.log('No user found');
 * }
 *
 * @example
 * const user = await findByEmail('admin@example.com');
 * console.log(user?.role ?? null);
 */
export async function findByEmail(email: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.email, email) });
}

/**
 * Finds a user by id and returns a sanitized profile
 *
 * This variant is intended for service layers that need identity or profile
 * information but should not receive password material. The lookup returns
 * `undefined` when the account does not exist.
 *
 * @param {string} id - User UUID to load
 * @returns {Promise<SafeUser | undefined>} Sanitized user row, or `undefined` when the account is absent
 * @throws {Error} Propagates database errors from the underlying query
 *
 * @example
 * const user = await findById('user-123');
 *
 * @example
 * const user = await findById('user-123');
 * console.log(user?.email ?? null);
 *
 * @example
 * if (!(await findById('missing-user'))) {
 *   console.log('No user found');
 * }
 */
export async function findById(id: string): Promise<SafeUser | undefined> {
  return getCachedOrFetch(userCacheKey(id), USER_CACHE_TTL, async () => {
    const user = await db.query.users.findFirst({ where: eq(users.id, id) });
    return user ? stripPasswordHash(user) : undefined;
  });
}

/**
 * Finds a user by id while preserving the password hash
 *
 * Auth flows that need to verify or replace credentials use this method to
 * access the full stored row. It mirrors `findById` but intentionally keeps
 * the password hash intact for password-sensitive operations.
 *
 * @param {string} id - User UUID to load
 * @returns {Promise<User | undefined>} Raw user row including `password_hash`, or `undefined` when absent
 * @throws {Error} Propagates database errors from the underlying query
 *
 * @example
 * const user = await findByIdWithPassword('user-123');
 *
 * @example
 * const user = await findByIdWithPassword('user-123');
 * console.log(user?.password_hash != null);
 *
 * @example
 * if (!(await findByIdWithPassword('missing-user'))) {
 *   console.log('No user found');
 * }
 */
export async function findByIdWithPassword(id: string): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

/**
 * Creates a new user row and returns the sanitized result
 *
 * Supports both standalone inserts and inserts inside a caller-managed
 * transaction, which is useful for registration flows that perform additional
 * writes alongside the user record. The returned value never exposes the
 * password hash.
 *
 * @param {NewUser} data - Insert payload matching the `users` schema
 * @param {DbTransaction} [tx] - Optional transaction to reuse instead of the shared DB client
 * @returns {Promise<SafeUser>} Newly created user row without the password hash
 * @throws {Error} Propagates database errors from the insert statement
 *
 * @example
 * const user = await createUser(data);
 *
 * @example
 * await db.transaction(async (tx) => {
 *   await createUser(data, tx);
 * });
 *
 * @example
 * const user = await createUser(data);
 * console.log(user.id);
 */
export async function createUser(data: NewUser, tx?: DbTransaction): Promise<SafeUser> {
  const client = tx ?? db;
  const [user] = await client.insert(users).values(data).returning();
  return stripPasswordHash(user);
}

/**
 * Updates the password hash for an existing user
 *
 * Used by password reset and password change flows after a new hash has
 * already been computed by the service layer. The write also refreshes the
 * row timestamp for audit consistency.
 *
 * @param {string} userId - User UUID whose password hash should be replaced
 * @param {string} passwordHash - Newly computed bcrypt hash to persist
 * @returns {Promise<void>} Promise that resolves once the update completes
 * @throws {Error} Propagates database errors from the update statement
 *
 * @example
 * await updatePassword('user-123', '$2b$12$...');
 *
 * @example
 * await updatePassword(user.id, nextHash);
 *
 * @example
 * await updatePassword('user-123', passwordHash);
 */
export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await db
    .update(users)
    .set({ password_hash: passwordHash, updated_at: new Date() })
    .where(eq(users.id, userId));
  await invalidateUserCache(userId);
}

/**
 * Toggles the forced-password-change flag on a user
 *
 * Admin or security flows can use this to require a user to replace their
 * password on the next successful login. The helper only persists the flag and
 * refreshes the standard update timestamp.
 *
 * @param {string} userId - User UUID whose force-change flag should be updated
 * @param {boolean} value - New forced-password-change state
 * @returns {Promise<void>} Promise that resolves once the update completes
 * @throws {Error} Propagates database errors from the update statement
 *
 * @example
 * await updateForcePasswordChange('user-123', true);
 *
 * @example
 * await updateForcePasswordChange(user.id, false);
 *
 * @example
 * await updateForcePasswordChange('user-123', shouldForceChange);
 */
export async function updateForcePasswordChange(
  userId: string,
  value: boolean
): Promise<void> {
  await db
    .update(users)
    .set({ force_password_change: value, updated_at: new Date() })
    .where(eq(users.id, userId));
  await invalidateUserCache(userId);
}

/**
 * Marks a user's email as verified and activates the account
 *
 * Email verification consumes a token and then promotes the user from the
 * pending verification state to active status in a single write. The update
 * also stamps the verification and modification timestamps.
 *
 * @param {string} userId - User UUID whose email should be marked verified
 * @returns {Promise<void>} Promise that resolves once the activation update completes
 * @throws {Error} Propagates database errors from the update statement
 *
 * @example
 * await updateEmailVerified('user-123');
 *
 * @example
 * await updateEmailVerified(user.id);
 *
 * @example
 * await updateEmailVerified(record.user_id);
 */
export async function updateEmailVerified(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ email_verified_at: new Date(), status: 'active', updated_at: new Date() })
    .where(eq(users.id, userId));
  await invalidateUserCache(userId);
}

/**
 * Applies a partial profile update to a user
 *
 * Supports profile-edit flows that can modify first name, last name, or phone
 * without touching auth-specific fields. The updated row is returned in its
 * sanitized form so service layers can reuse it immediately in responses.
 *
 * @param {string} userId - User UUID whose profile should be updated
 * @param {{ first_name?: string; last_name?: string; phone?: string | null }} data - Partial profile fields to persist
 * @returns {Promise<SafeUser>} Updated user row without the password hash
 * @throws {Error} If the update unexpectedly returns no row
 *
 * @example
 * const user = await updateProfile('user-123', { first_name: 'Jane' });
 *
 * @example
 * const user = await updateProfile('user-123', {
 *   last_name: 'Doe',
 *   phone: '+22901020304',
 * });
 *
 * @example
 * const user = await updateProfile(userId, { phone: null });
 */
export async function updateProfile(
  userId: string,
  data: { first_name?: string; last_name?: string; phone?: string | null }
): Promise<SafeUser> {
  const [row] = await db
    .update(users)
    .set({ ...data, updated_at: new Date() })
    .where(eq(users.id, userId))
    .returning();
  if (!row) throw new Error('Update profile failed');
  await invalidateUserCache(userId);
  return stripPasswordHash(row);
}

/**
 * Soft-deletes a user while scrubbing identifying profile fields
 *
 * Instead of removing the row entirely, this helper rewrites personal data and
 * marks the account as deleted so historical references remain intact. The
 * caller provides an email hash to keep the replacement email unique.
 *
 * @param {string} userId - User UUID to soft-delete
 * @param {string} emailHash - Hashed email fragment used to build a unique deleted placeholder address
 * @returns {Promise<void>} Promise that resolves once the soft-delete update completes
 * @throws {Error} Propagates database errors from the update statement
 *
 * @example
 * await softDeleteUser('user-123', 'abc123');
 *
 * @example
 * await softDeleteUser(user.id, emailHash);
 *
 * @example
 * await softDeleteUser('user-123', 'deadbeef');
 */
export async function softDeleteUser(userId: string, emailHash: string): Promise<void> {
  await db
    .update(users)
    .set({
      status: 'deleted',
      email: `${emailHash}@deleted`,
      first_name: '[deleted]',
      last_name: '[deleted]',
      phone: null,
      updated_at: new Date(),
    })
    .where(eq(users.id, userId));
  await invalidateUserCache(userId);
}
