import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userNotificationPrefs } from '@/lib/db/schema';

export type ClientNotificationPrefs = {
  wash_status: boolean;
  reminder: boolean;
  offers: boolean;
  review: boolean;
};

export const DEFAULT_CLIENT_NOTIFICATION_PREFS: ClientNotificationPrefs = {
  wash_status: true,
  reminder: true,
  offers: false,
  review: true,
};

export async function getClientNotificationPrefs(userId: string): Promise<ClientNotificationPrefs> {
  const row = await db.query.userNotificationPrefs.findFirst({
    where: eq(userNotificationPrefs.user_id, userId),
    columns: { prefs: true },
  });
  const raw = (row?.prefs as Record<string, unknown> | undefined) ?? {};
  return {
    wash_status: raw.wash_status !== false,
    reminder: raw.reminder !== false,
    offers: raw.offers === true,
    review: raw.review !== false,
  };
}

export async function patchClientNotificationPrefs(
  userId: string,
  patch: Partial<ClientNotificationPrefs>
): Promise<ClientNotificationPrefs> {
  const current = await getClientNotificationPrefs(userId);
  const merged: ClientNotificationPrefs = { ...current, ...patch };

  await db
    .insert(userNotificationPrefs)
    .values({
      user_id: userId,
      prefs: merged,
      updated_at: new Date(),
    })
    .onConflictDoUpdate({
      target: userNotificationPrefs.user_id,
      set: { prefs: merged, updated_at: new Date() },
    });

  return merged;
}
