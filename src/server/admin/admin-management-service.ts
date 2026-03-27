import { NotFoundError, ConflictError } from '@/lib/errors';
import { insertAdminLog } from './admin-log-repository';
import * as repo from './admin-user-repository';
import type { UpdateUserInput, UpdateStationAdminInput } from '@/validators/admin-user';

/**
 * Updates whitelisted user fields and writes an audit log entry.
 *
 * @throws NotFoundError — user not found
 */
export async function updateUser(
  adminId: string,
  userId: string,
  data: UpdateUserInput
): Promise<repo.AdminSafeUser> {
  const before = await repo.findUserForAdmin(userId);
  if (!before) throw new NotFoundError('User not found');

  const after = await repo.updateUserById(userId, data);
  if (!after) throw new NotFoundError('User not found');

  await insertAdminLog({
    admin_id: adminId,
    action: 'UPDATE_USER',
    target_type: 'user',
    target_id: userId,
    details: { before, after },
  });

  return after;
}

/**
 * Sets the user status to 'active' and clears auth rate limits.
 * Logs the action with before/after status.
 *
 * @throws NotFoundError — user not found
 * @throws ConflictError — account is already active
 */
export async function unblockUser(
  adminId: string,
  userId: string
): Promise<repo.AdminSafeUser> {
  const user = await repo.findUserForAdmin(userId);
  if (!user) throw new NotFoundError('User not found');
  if (user.status === 'active') throw new ConflictError('Account is already active');

  const statusBefore = user.status;

  const after = await repo.updateUserById(userId, { status: 'active' });
  if (!after) throw new NotFoundError('User not found');

  // Clear any IP rate limit keyed by the user's email (best-effort: do not fail the unblock if this errors).
  await repo.clearRateLimitByEmail(user.email).catch(() => {});

  await insertAdminLog({
    admin_id: adminId,
    action: 'UNBLOCK_ACCOUNT',
    target_type: 'user',
    target_id: userId,
    details: { before: { status: statusBefore }, after: { status: after.status } },
  });

  return after;
}

/**
 * Updates whitelisted station fields and writes an audit log entry.
 *
 * @throws NotFoundError — station not found
 */
export async function updateStation(
  adminId: string,
  stationId: string,
  data: UpdateStationAdminInput
): Promise<repo.AdminStation> {
  const before = await repo.findStationForAdmin(stationId);
  if (!before) throw new NotFoundError('Station not found');

  const after = await repo.updateStationById(stationId, data);
  if (!after) throw new NotFoundError('Station not found');

  await insertAdminLog({
    admin_id: adminId,
    action: 'UPDATE_STATION',
    target_type: 'station',
    target_id: stationId,
    details: { before, after },
  });

  return after;
}
