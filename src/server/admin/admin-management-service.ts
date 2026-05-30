import bcrypt from 'bcrypt';
import { NotFoundError, ConflictError } from '@/lib/errors';
import { insertAdminLog } from './admin-log-repository';
import * as repo from './admin-user-repository';
import { generatePassword } from '@/helpers/generate-password';
import { sendAdminWelcomeEmail } from '@/lib/email';
import { BCRYPT_ROUNDS } from '@/helpers/server-constants';
import type { UpdateUserInput, UpdateStationAdminInput, CreateUserInput, CreateStationAdminInput } from '@/validators/admin-user';


// %%%%% Admin management service %%%%%
// Orchestrates admin-initiated mutations for users and stations.
// Every mutation is guarded by a pre-fetch, followed by an audit log entry.


// ooooo Internal helpers ooooo

/**
 * Builds a standard `{ before, after }` diff payload for audit log entries.
 *
 * @param before - Snapshot captured before the mutation.
 * @param after  - Snapshot captured after the mutation.
 * @returns Plain object suitable for the `details` field of an admin log entry.
 */
function buildDiff<T>(before: T, after: T): { before: T; after: T } {
  return { before, after };
}

/**
 * Strips fields that must not appear in audit snapshots for stations.
 *
 * `stripe_account_id` and `rejection_reason` are excluded from before/after
 * diffs that could be read by lower-privilege tooling or exported for reporting.
 *
 * @param station - Full station record as returned by the repository.
 * @returns A copy of the record with sensitive fields omitted.
 */
function stripSensitiveStationFields(
  station: repo.AdminStation
): Omit<repo.AdminStation, 'stripe_account_id' | 'rejection_reason'> {
  const { stripe_account_id: _stripe, rejection_reason: _rej, ...safe } = station;
  return safe;
}

/**
 * Strips fields that must not appear in audit snapshots for users.
 *
 * `stripe_customer_id` is an external linkable identifier; keeping it out of
 * audit log details mirrors the existing `stripe_account_id` treatment for
 * stations and limits blast radius if log storage is ever misconfigured.
 * `password_hash` is already stripped by the repository layer before this
 * function is ever called, but the exclusion is listed for clarity.
 *
 * @param user - Safe user record as returned by the repository (password_hash already omitted).
 * @returns A copy of the record with stripe_customer_id omitted.
 */
function stripSensitiveUserFields(
  user: repo.AdminSafeUser
): Omit<repo.AdminSafeUser, 'stripe_customer_id'> {
  const { stripe_customer_id: _stripe, ...safe } = user;
  return safe;
}


// ooooo END - Internal helpers ooooo


// ooooo User operations ooooo

export type AdminUserRow = Omit<repo.AdminSafeUser, 'stripe_customer_id'>;
export type PaginationMeta = { total: number; page: number; per_page: number; total_pages: number };

/**
 * Lists client accounts with pagination, optionally filtered by status.
 * Strips stripe_customer_id from every row for consistency with other user endpoints.
 */
export async function listUsers(
  status?: string,
  page = 1,
  perPage = 20,
): Promise<{ users: AdminUserRow[]; meta: PaginationMeta }> {
  const safePer = Math.min(100, Math.max(1, perPage));
  const { rows, total } = await repo.listUsersForAdmin(status, page, safePer);
  return {
    users: rows.map(({ stripe_customer_id: _stripe, ...safe }) => safe),
    meta: {
      total,
      page,
      per_page: safePer,
      total_pages: Math.max(1, Math.ceil(total / safePer)),
    },
  };
}

/**
 * Updates whitelisted user fields and writes an audit log entry.
 *
 * @param adminId - ID of the admin performing the action.
 * @param userId  - ID of the user being updated.
 * @param data    - Validated subset of user fields to apply.
 * @returns The updated user record with stripe_customer_id omitted.
 * @throws {NotFoundError} If the user does not exist before or after the update.
 */
export async function updateUser(
  adminId: string,
  userId: string,
  data: UpdateUserInput
): Promise<Omit<repo.AdminSafeUser, 'stripe_customer_id'>> {
  const before = await repo.findUserForAdmin(userId);
  if (!before) throw new NotFoundError('User not found');

  const after = await repo.updateUserById(userId, data);
  if (!after) throw new NotFoundError('User not found');

  insertAdminLog({
    admin_id: adminId,
    action: 'UPDATE_USER',
    target_type: 'user',
    target_id: userId,
    details: buildDiff(
      stripSensitiveUserFields(before),
      stripSensitiveUserFields(after)
    ),
  }).catch((err) => console.error('[admin-log] Failed to write audit log', err));

  return stripSensitiveUserFields(after);
}

/**
 * Sets the user status to `active` and clears auth rate limits.
 * Logs the action with a before/after status diff.
 *
 * @param adminId - ID of the admin performing the action.
 * @param userId  - ID of the user being unblocked.
 * @returns The updated user record with stripe_customer_id omitted.
 * @throws {NotFoundError} If the user does not exist before or after the update.
 * @throws {ConflictError} If the account is already active.
 */
export async function unblockUser(
  adminId: string,
  userId: string
): Promise<Omit<repo.AdminSafeUser, 'stripe_customer_id'>> {
  const user = await repo.findUserForAdmin(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.status === 'active') throw new ConflictError('Account is already active');

  const statusBefore = user.status;

  const after = await repo.updateUserById(userId, { status: 'active' });
  if (!after) throw new NotFoundError('User not found');

  // Clear any IP rate limit keyed by the user's email.
  // Best-effort: do not fail the unblock if this errors.
  await repo.clearRateLimitByEmail(user.email).catch(() => {});

  insertAdminLog({
    admin_id: adminId,
    action: 'UNBLOCK_ACCOUNT',
    target_type: 'user',
    target_id: userId,
    // Narrow diff: only the status field changed; no full snapshot needed here,
    // so sensitive fields are not in scope. Kept explicit for consistency.
    details: buildDiff({ status: statusBefore }, { status: after.status }),
  }).catch((err) => console.error('[admin-log] Failed to write audit log', err));

  return stripSensitiveUserFields(after);
}


// ooooo END - User operations ooooo


// ooooo Station operations ooooo

/**
 * Updates whitelisted station fields and writes an audit log entry.
 *
 * Sensitive fields (`stripe_account_id`, `rejection_reason`) are stripped from
 * both the audit snapshot and the return value. Callers receive the safe subset;
 * the full record is never surfaced outside the service layer.
 *
 * @param adminId   - ID of the admin performing the action.
 * @param stationId - ID of the station being updated.
 * @param data      - Validated subset of station fields to apply.
 * @returns The updated station record with stripe_account_id and rejection_reason omitted.
 * @throws {NotFoundError} If the station does not exist before or after the update.
 */
export async function updateStation(
  adminId: string,
  stationId: string,
  data: UpdateStationAdminInput
): Promise<Omit<repo.AdminStation, 'stripe_account_id' | 'rejection_reason'>> {
  const before = await repo.findStationForAdmin(stationId);
  if (!before) throw new NotFoundError('Station not found');

  const after = await repo.updateStationById(stationId, data);
  if (!after) throw new NotFoundError('Station not found');

  insertAdminLog({
    admin_id: adminId,
    action: 'UPDATE_STATION',
    target_type: 'station',
    target_id: stationId,
    details: buildDiff(
      stripSensitiveStationFields(before),
      stripSensitiveStationFields(after)
    ),
  }).catch((err) => console.error('[admin-log] Failed to write audit log', err));

  return stripSensitiveStationFields(after);
}


// ooooo END - Station operations ooooo


// ooooo Create / delete user ooooo

/**
 * Creates a new user account (client or admin).
 *
 * Validates email uniqueness, generates a temporary password, hashes it with bcrypt,
 * inserts the user, dispatches a welcome email (best-effort), and writes an audit log.
 *
 * @param adminId - ID of the admin performing the action.
 * @param data    - Validated create-user input (name, email, role, optional phone).
 * @returns The created user with stripe_customer_id omitted.
 * @throws {ConflictError} If a user with the same email already exists.
 */
export async function createUser(
  adminId: string,
  data: CreateUserInput
): Promise<Omit<repo.AdminSafeUser, 'stripe_customer_id'>> {
  const existing = await repo.findUserByEmail(data.email);
  if (existing) throw new ConflictError('Email address is already in use');

  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const user = await repo.insertUser({
    first_name:            data.first_name,
    last_name:             data.last_name,
    email:                 data.email,
    phone:                 data.phone ?? null,
    password_hash:         passwordHash,
    role:                  data.role,
    status:                'active',
    force_password_change: true,
    email_verified_at:     new Date(),
  });

  sendAdminWelcomeEmail(user.email, data.first_name, tempPassword, data.role).catch((err) =>
    console.error('[admin-management-service] Welcome email failed', err)
  );

  insertAdminLog({
    admin_id:    adminId,
    action:      'CREATE_USER',
    target_type: 'user',
    target_id:   user.id,
    details:     { email: user.email, role: user.role },
  }).catch((err) => console.error('[admin-log] Failed to write audit log', err));

  return stripSensitiveUserFields(user);
}

/**
 * Deletes or soft-blocks a user account.
 *
 * Soft delete: sets status to 'blocked' (reversible).
 * Hard delete: permanently removes the row from the database.
 *
 * @param adminId   - ID of the admin performing the action.
 * @param userId    - ID of the user to delete.
 * @param permanent - When true, performs a hard (irreversible) delete.
 * @returns The updated user (soft) or { deleted: true } (hard).
 * @throws {NotFoundError} If the user does not exist.
 * @throws {ConflictError} If the admin attempts to delete their own account.
 */
export async function deleteUser(
  adminId: string,
  userId: string,
  permanent: boolean
): Promise<Omit<repo.AdminSafeUser, 'stripe_customer_id'> | { deleted: true }> {
  if (adminId === userId) throw new ConflictError('You cannot delete your own account');

  const before = await repo.findUserForAdmin(userId);
  if (!before) throw new NotFoundError('User not found');

  if (permanent) {
    await repo.hardDeleteUserById(userId);
    insertAdminLog({
      admin_id:    adminId,
      action:      'DELETE_USER_PERMANENT',
      target_type: 'user',
      target_id:   userId,
      details:     { email: before.email, role: before.role },
    }).catch((err) => console.error('[admin-log] Failed to write audit log', err));
    return { deleted: true };
  }

  const after = await repo.updateUserById(userId, { status: 'blocked' });
  if (!after) throw new NotFoundError('User not found');

  insertAdminLog({
    admin_id:    adminId,
    action:      'DELETE_USER_SOFT',
    target_type: 'user',
    target_id:   userId,
    details:     buildDiff({ status: before.status }, { status: after.status }),
  }).catch((err) => console.error('[admin-log] Failed to write audit log', err));

  return stripSensitiveUserFields(after);
}

// ooooo END - Create / delete user ooooo


// ooooo Create / delete station ooooo

/**
 * Creates a station owner user (role='station') and a station record in a single operation.
 *
 * Both the user and station are inserted separately (no DB transaction, but user insert
 * happens first — if the station insert fails, the orphan user is harmless and can be deleted).
 * Welcome email is sent best-effort.
 *
 * @param adminId - ID of the admin performing the action.
 * @param data    - Validated create-station input (owner + station data).
 * @returns An object containing the created user and station records (sensitive fields stripped).
 * @throws {ConflictError} If a user with the owner email already exists.
 */
export async function createStation(
  adminId: string,
  data: CreateStationAdminInput
): Promise<{
  user: Omit<repo.AdminSafeUser, 'stripe_customer_id'>;
  station: Omit<repo.AdminStation, 'stripe_account_id' | 'rejection_reason'>;
}> {
  const existing = await repo.findUserByEmail(data.owner.email);
  if (existing) throw new ConflictError('Email address is already in use');

  const tempPassword = generatePassword();
  const passwordHash = await bcrypt.hash(tempPassword, BCRYPT_ROUNDS);

  const user = await repo.insertUser({
    first_name:            data.owner.first_name,
    last_name:             data.owner.last_name,
    email:                 data.owner.email,
    phone:                 data.owner.phone ?? null,
    password_hash:         passwordHash,
    role:                  'station',
    status:                'active',
    force_password_change: true,
    email_verified_at:     new Date(),
  });

  const station = await repo.insertStation({
    user_id:       user.id,
    name:          data.station.name,
    legal_name:    data.station.legal_name ?? null,
    address:       data.station.address,
    city:          data.station.city,
    service_scope: data.station.service_scope ?? null,
    description:   data.station.description ?? null,
    status:        'active',
    is_open:       false,
    approved_at:   new Date(),
    approved_by:   adminId,
  });

  sendAdminWelcomeEmail(user.email, data.owner.first_name, tempPassword, 'station').catch((err) =>
    console.error('[admin-management-service] Station welcome email failed', err)
  );

  insertAdminLog({
    admin_id:    adminId,
    action:      'CREATE_STATION',
    target_type: 'station',
    target_id:   station.id,
    details:     { owner_email: user.email, station_name: station.name },
  }).catch((err) => console.error('[admin-log] Failed to write audit log', err));

  return {
    user:    stripSensitiveUserFields(user),
    station: stripSensitiveStationFields(station),
  };
}

/**
 * Deletes or soft-disables a station.
 *
 * Soft delete: sets station status to 'disabled'.
 * Hard delete: permanently removes the station row from the database.
 *
 * @param adminId   - ID of the admin performing the action.
 * @param stationId - ID of the station to delete.
 * @param permanent - When true, performs a hard (irreversible) delete.
 * @returns The updated station (soft) or { deleted: true } (hard).
 * @throws {NotFoundError} If the station does not exist.
 */
export async function deleteStation(
  adminId: string,
  stationId: string,
  permanent: boolean
): Promise<Omit<repo.AdminStation, 'stripe_account_id' | 'rejection_reason'> | { deleted: true }> {
  const before = await repo.findStationForAdmin(stationId);
  if (!before) throw new NotFoundError('Station not found');

  if (permanent) {
    await repo.hardDeleteStationById(stationId);
    insertAdminLog({
      admin_id:    adminId,
      action:      'DELETE_STATION_PERMANENT',
      target_type: 'station',
      target_id:   stationId,
      details:     { name: before.name },
    }).catch((err) => console.error('[admin-log] Failed to write audit log', err));
    return { deleted: true };
  }

  const after = await repo.updateStationById(stationId, { status: 'disabled' });
  if (!after) throw new NotFoundError('Station not found');

  insertAdminLog({
    admin_id:    adminId,
    action:      'DELETE_STATION_SOFT',
    target_type: 'station',
    target_id:   stationId,
    details:     buildDiff({ status: before.status }, { status: after.status }),
  }).catch((err) => console.error('[admin-log] Failed to write audit log', err));

  return stripSensitiveStationFields(after);
}

// ooooo END - Create / delete station ooooo


// %%%%% END - Admin management service %%%%%
