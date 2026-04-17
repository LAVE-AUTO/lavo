/**
 * Device token service.
 * Business logic for registering FCM device tokens per user.
 * The upsert strategy: insert the token if new; if the token row already
 * belongs to this user, do nothing (no-op on conflict). If the same physical
 * token was previously registered under a different user account it will be
 * reassigned to the current user (conflict on token → update user_id).
 *
 * A per-user cap of MAX_TOKENS_PER_USER is enforced: once reached, the oldest
 * token(s) for that user are removed before inserting the new one so the table
 * does not grow unboundedly.
 */
import { count, eq, inArray, asc } from 'drizzle-orm';

import { db } from '@/lib/db';
import { deviceTokens } from '@/lib/db/schema';


// %%%%% Constants %%%%%
// Per-user device token cap

/** Maximum number of FCM tokens retained per user. Oldest tokens are pruned first. */
const MAX_TOKENS_PER_USER = 25;


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
  // Wrap in a transaction so the count → prune → insert sequence is atomic.
  // Without a transaction, concurrent requests for the same user could each
  // read the same count and both proceed to insert, exceeding MAX_TOKENS_PER_USER.
  await db.transaction(async (tx) => {
    const [countRow] = await tx
      .select({ value: count() })
      .from(deviceTokens)
      .where(eq(deviceTokens.user_id, userId));

    const currentCount = countRow?.value ?? 0;

    if (currentCount >= MAX_TOKENS_PER_USER) {
      // Remove the oldest token(s) to stay within the cap.
      const overflow = currentCount - MAX_TOKENS_PER_USER + 1;
      const oldest = await tx
        .select({ token: deviceTokens.token })
        .from(deviceTokens)
        .where(eq(deviceTokens.user_id, userId))
        .orderBy(asc(deviceTokens.created_at))
        .limit(overflow);

      if (oldest.length > 0) {
        await tx
          .delete(deviceTokens)
          .where(inArray(deviceTokens.token, oldest.map((r) => r.token)));
      }
    }

    await tx
      .insert(deviceTokens)
      .values({ user_id: userId, token, platform })
      .onConflictDoUpdate({
        target: deviceTokens.token,
        set: { user_id: userId, platform },
      });
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
  await db.delete(deviceTokens).where(inArray(deviceTokens.token, tokens));
}
