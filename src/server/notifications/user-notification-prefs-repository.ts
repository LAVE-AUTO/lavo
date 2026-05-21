import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { userNotificationPrefs } from '@/lib/db/schema';

export type ClientNotificationPrefs = {
  wash_status: boolean;
  reminder: boolean;
  offers: boolean;
  review: boolean;
};

export type AdminNotificationPrefs = {
  station_lifecycle: {
    in_app: boolean;
    push: boolean;
    email: boolean;
  };
  kyc_alerts: {
    in_app: boolean;
    push: boolean;
    email: boolean;
  };
  support_alerts: {
    in_app: boolean;
    push: boolean;
    email: boolean;
  };
};

export const DEFAULT_CLIENT_NOTIFICATION_PREFS: ClientNotificationPrefs = {
  wash_status: true,
  reminder: true,
  offers: false,
  review: true,
};

export const DEFAULT_ADMIN_NOTIFICATION_PREFS: AdminNotificationPrefs = {
  station_lifecycle: { in_app: true, push: true, email: true },
  kyc_alerts: { in_app: true, push: true, email: true },
  support_alerts: { in_app: true, push: true, email: true },
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

function mergeAdminChannelPrefs(
  current: { in_app: boolean; push: boolean; email: boolean },
  patch: Partial<{ in_app: boolean; push: boolean; email: boolean }> | undefined
): { in_app: boolean; push: boolean; email: boolean } {
  return {
    in_app: patch?.in_app ?? current.in_app,
    push: patch?.push ?? current.push,
    email: patch?.email ?? current.email,
  };
}

export async function getAdminNotificationPrefs(userId: string): Promise<AdminNotificationPrefs> {
  const row = await db.query.userNotificationPrefs.findFirst({
    where: eq(userNotificationPrefs.user_id, userId),
    columns: { prefs: true },
  });
  const raw = (row?.prefs as Record<string, unknown> | undefined) ?? {};

  const fromRaw = (key: keyof AdminNotificationPrefs) => {
    const value = raw[key] as Record<string, unknown> | undefined;
    const defaults = DEFAULT_ADMIN_NOTIFICATION_PREFS[key];
    return {
      in_app: value?.in_app !== false ? defaults.in_app : false,
      push: value?.push !== false ? defaults.push : false,
      email: value?.email !== false ? defaults.email : false,
    };
  };

  return {
    station_lifecycle: fromRaw('station_lifecycle'),
    kyc_alerts: fromRaw('kyc_alerts'),
    support_alerts: fromRaw('support_alerts'),
  };
}

export async function patchAdminNotificationPrefs(
  userId: string,
  patch: Partial<AdminNotificationPrefs>
): Promise<AdminNotificationPrefs> {
  const current = await getAdminNotificationPrefs(userId);
  const merged: AdminNotificationPrefs = {
    station_lifecycle: mergeAdminChannelPrefs(current.station_lifecycle, patch.station_lifecycle),
    kyc_alerts: mergeAdminChannelPrefs(current.kyc_alerts, patch.kyc_alerts),
    support_alerts: mergeAdminChannelPrefs(current.support_alerts, patch.support_alerts),
  };

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
