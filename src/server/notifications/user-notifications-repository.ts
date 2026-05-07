/**
 * Data access for in-app user notification feed.
 * Uses cursor-based pagination (created_at DESC, id DESC) for real-time safety.
 */
import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userNotifications } from '@/lib/db/schema';

export type UserNotification = typeof userNotifications.$inferSelect;


/**
 * Lists notifications for a user with cursor-based pagination.
 * Cursor encodes (created_at, id) to avoid duplicate rows during real-time inserts.
 */
export async function listNotificationsByUser(
  userId: string,
  options: {
    limit: number;
    cursor?: string;
    unread_only?: boolean;
  }
): Promise<{ items: UserNotification[]; next_cursor: string | null; unread_count: number }> {
  const { limit, cursor, unread_only } = options;
  const safeLimit = Math.min(Math.max(1, limit), 100);

  const conditions = [eq(userNotifications.user_id, userId)];
  if (unread_only) conditions.push(isNull(userNotifications.read_at));

  if (cursor) {
    try {
      const [cursorTs, cursorId] = Buffer.from(cursor, 'base64').toString().split('|');
      const cursorDate = new Date(cursorTs ?? '');
      // Validate cursorId is a UUID before passing it to a query against a uuid column.
      // Without this, a forged cursor would trigger a Postgres "invalid input syntax for
      // type uuid" error and surface as a 500 to the caller.
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!Number.isNaN(cursorDate.getTime()) && cursorId && UUID_RE.test(cursorId)) {
        conditions.push(
          or(
            lt(userNotifications.created_at, cursorDate),
            and(
              eq(userNotifications.created_at, cursorDate),
              lt(userNotifications.id, cursorId)
            )
          )!
        );
      }
    } catch { /* invalid cursor - ignore, return from start */ }
  }

  const where = and(...conditions);

  const [unreadRows, items] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(userNotifications)
      .where(and(eq(userNotifications.user_id, userId), isNull(userNotifications.read_at))),
    db.query.userNotifications.findMany({
      where,
      orderBy: [desc(userNotifications.created_at), desc(userNotifications.id)],
      limit: safeLimit + 1,
    }),
  ]);

  const hasMore = items.length > safeLimit;
  const page = hasMore ? items.slice(0, safeLimit) : items;

  let next_cursor: string | null = null;
  if (hasMore && page.length > 0) {
    const last = page[page.length - 1]!;
    next_cursor = Buffer.from(`${last.created_at.toISOString()}|${last.id}`).toString('base64');
  }

  return { items: page, next_cursor, unread_count: unreadRows[0]?.count ?? 0 };
}

/**
 * Returns the count of unread notifications for a user.
 */
export async function countUnreadNotifications(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userNotifications)
    .where(and(eq(userNotifications.user_id, userId), isNull(userNotifications.read_at)));
  return row?.count ?? 0;
}

/**
 * Marks a single notification as read. Ownership check included. Idempotent: if
 * the notification is already read the existing row is returned unchanged.
 * Returns the row, or undefined if not found or not owned by user.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string
): Promise<UserNotification | undefined> {
  // First attempt to update (only when unread).
  const [updated] = await db
    .update(userNotifications)
    .set({ read_at: new Date() })
    .where(
      and(
        eq(userNotifications.id, notificationId),
        eq(userNotifications.user_id, userId),
        isNull(userNotifications.read_at)
      )
    )
    .returning();
  if (updated) return updated;

  // No row was updated - either it does not exist, is not owned by this user,
  // or it was already read. Fetch the row to distinguish the two cases.
  return db.query.userNotifications.findFirst({
    where: and(
      eq(userNotifications.id, notificationId),
      eq(userNotifications.user_id, userId)
    ),
  });
}

/**
 * Marks all unread notifications as read for a user.
 * Returns the count of rows updated.
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const rows = await db
    .update(userNotifications)
    .set({ read_at: new Date() })
    .where(and(eq(userNotifications.user_id, userId), isNull(userNotifications.read_at)))
    .returning({ id: userNotifications.id });
  return rows.length;
}

/**
 * Deletes a single notification. Ownership check included.
 * Returns true if deleted, false if not found or not owned by user.
 */
export async function deleteNotification(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const rows = await db
    .delete(userNotifications)
    .where(
      and(eq(userNotifications.id, notificationId), eq(userNotifications.user_id, userId))
    )
    .returning({ id: userNotifications.id });
  return rows.length > 0;
}
