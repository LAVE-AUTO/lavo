/**
 * Device token service.
 * Business logic for registering FCM device tokens per user.
 * The upsert strategy: insert the token if new; if the token row already
 * belongs to this user, do nothing (no-op on conflict). If the same physical
 * token was previously registered under a different user account it will be
 * reassigned to the current user (conflict on token → update user_id).
 */
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db';
import { deviceTokens } from '@/lib/db/schema';


// %%%%% Token operations %%%%%
// Upsert, read, and remove device tokens

/**
 * Upserts an FCM device token for the given user.
 * If the token already exists it is kept unchanged (idempotent per user).
 * If it existed under another user it is reassigned to the current user.
 *
 * @param userId   - UUID of the authenticated user
 * @param token    - FCM registration token from the client SDK
 * @param platform - Target platform: 'ios' | 'android' | 'web'
 */
export async function upsertDeviceToken(
  userId: string,
  token: string,
  platform: string
): Promise<void> {
  await db
    .insert(deviceTokens)
    .values({ user_id: userId, token, platform })
    .onConflictDoUpdate({
      target: deviceTokens.token,
      set: { user_id: userId, platform },
    });
}

/**
 * Returns all FCM tokens registered for the given user.
 *
 * @param userId - UUID of the user
 */
export async function getTokensForUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ token: deviceTokens.token })
    .from(deviceTokens)
    .where(eq(deviceTokens.user_id, userId));
  return rows.map((r) => r.token);
}

/**
 * Removes a list of FCM tokens from the database.
 * Called after FCM confirms that tokens are no longer valid.
 *
 * @param tokens - Array of expired/invalid FCM tokens to delete
 */
export async function removeExpiredTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  for (const token of tokens) {
    await db.delete(deviceTokens).where(eq(deviceTokens.token, token));
  }
}
