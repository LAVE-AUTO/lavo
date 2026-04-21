import { NotFoundError, ConflictError } from '@/lib/errors';
import { insertAdminLog } from './admin-log-repository';
import * as repo from './admin-user-repository';
import type { UpdateUserInput, UpdateStationAdminInput } from '@/validators/admin-user';


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

  await insertAdminLog({
    admin_id: adminId,
    action: 'UPDATE_USER',
    target_type: 'user',
    target_id: userId,
    details: buildDiff(
      stripSensitiveUserFields(before),
      stripSensitiveUserFields(after)
    ),
  });

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

  await insertAdminLog({
    admin_id: adminId,
    action: 'UNBLOCK_ACCOUNT',
    target_type: 'user',
    target_id: userId,
    // Narrow diff: only the status field changed; no full snapshot needed here,
    // so sensitive fields are not in scope. Kept explicit for consistency.
    details: buildDiff({ status: statusBefore }, { status: after.status }),
  });

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

  await insertAdminLog({
    admin_id: adminId,
    action: 'UPDATE_STATION',
    target_type: 'station',
    target_id: stationId,
    details: buildDiff(
      stripSensitiveStationFields(before),
      stripSensitiveStationFields(after)
    ),
  });

  return stripSensitiveStationFields(after);
}


// ooooo END - Station operations ooooo


// %%%%% END - Admin management service %%%%%
