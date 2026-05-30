/**
 * Business logic for in-app user notification feed.
 */
import { NotFoundError } from '@/lib/errors';
import {
  listNotificationsByUser,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
  type UserNotification,
} from './user-notifications-repository';

export type { UserNotification };

export async function getMyNotifications(
  userId: string,
  options: { limit: number; cursor?: string; unread_only?: boolean }
): Promise<{ items: UserNotification[]; next_cursor: string | null; unread_count: number }> {
  return listNotificationsByUser(userId, options);
}

export async function getUnreadCount(userId: string): Promise<number> {
  return countUnreadNotifications(userId);
}

export async function readNotification(notificationId: string, userId: string): Promise<UserNotification> {
  const row = await markNotificationRead(notificationId, userId);
  if (!row) throw new NotFoundError('Notification not found');
  return row;
}

export async function readAllNotifications(userId: string): Promise<number> {
  return markAllNotificationsRead(userId);
}

export async function removeNotification(notificationId: string, userId: string): Promise<void> {
  const deleted = await deleteNotification(notificationId, userId);
  if (!deleted) throw new NotFoundError('Notification not found');
}
