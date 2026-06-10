import { and, eq } from 'drizzle-orm';
import { sendAdminOperationalEmail } from '@/lib/email';
import { db } from '@/lib/db';
import { notifications, users } from '@/lib/db/schema';
import { sendPushNotification } from './fcm-service';
import { getAdminNotificationPrefs } from './user-notification-prefs-repository';
import { insertUserNotification } from './user-notifications-repository';

export type AdminNotificationEventType =
  | 'station_application_submitted'
  | 'station_application_approved'
  | 'station_billing_changed'
  | 'kyc_expiry_reminder'
  | 'support_ticket_created'
  | 'support_message_received';

type AdminChannelPrefs = {
  in_app: boolean;
  push: boolean;
  email: boolean;
};

type AdminEventSpec = {
  kind: string;
  title: string;
  body: string;
  channelKey: 'station_lifecycle' | 'kyc_alerts' | 'support_alerts';
  action_url?: string | null;
  payload?: Record<string, unknown>;
};

type NotifyAdminEventParams = {
  type: AdminNotificationEventType;
  stationId?: string;
  actorUserId?: string;
  payload?: Record<string, unknown>;
};

const ADMIN_EVENT_SPECS: Record<AdminNotificationEventType, Omit<AdminEventSpec, 'payload'>> = {
  station_application_submitted: {
    kind: 'admin_station_application_submitted',
    title: 'New station application',
    body: 'A station has submitted a new application requiring review.',
    channelKey: 'station_lifecycle',
    action_url: '/admin/stations?status=pending_admin_validation',
  },
  station_application_approved: {
    kind: 'admin_station_application_approved',
    title: 'Station approved',
    body: 'A station application has been approved.',
    channelKey: 'station_lifecycle',
    action_url: '/admin/stations?status=active',
  },
  station_billing_changed: {
    kind: 'admin_station_billing_changed',
    title: 'Station billing model changed',
    body: 'A station changed its billing model (commission vs subscription).',
    channelKey: 'station_lifecycle',
    action_url: '/admin/stations',
  },
  kyc_expiry_reminder: {
    kind: 'admin_kyc_expiry_reminder',
    title: 'KYC expiry reminder',
    body: 'A station KYC document is approaching expiry.',
    channelKey: 'kyc_alerts',
    action_url: '/admin/stations',
  },
  support_ticket_created: {
    kind: 'admin_support_ticket_created',
    title: 'New support ticket',
    body: 'A new support ticket requires admin attention.',
    channelKey: 'support_alerts',
    action_url: '/admin/support',
  },
  support_message_received: {
    kind: 'admin_support_message_received',
    title: 'Support ticket updated',
    body: 'A support ticket received a new client message.',
    channelKey: 'support_alerts',
    action_url: '/admin/support',
  },
};

function computeChannelPrefs(
  prefs: Awaited<ReturnType<typeof getAdminNotificationPrefs>>,
  eventType: AdminNotificationEventType
): AdminChannelPrefs {
  const channelKey = ADMIN_EVENT_SPECS[eventType].channelKey;
  return prefs[channelKey];
}

async function insertAuditLog(input: {
  userId: string;
  stationId?: string;
  event: AdminNotificationEventType;
  type: 'in_app' | 'push' | 'email';
  status: 'sent' | 'skipped' | 'failed';
}): Promise<void> {
  await db.insert(notifications).values({
    user_id: input.userId,
    station_id: input.stationId ?? null,
    type: input.type,
    event: input.event,
    status: input.status,
    sent_at: input.status === 'sent' ? new Date() : null,
  });
}

export async function notifyAdminEvent(params: NotifyAdminEventParams): Promise<void> {
  const specBase = ADMIN_EVENT_SPECS[params.type];
  let admins: Array<{ id: string; email: string; first_name: string | null; last_name: string | null }> = [];
  try {
    admins = await db.query.users.findMany({
      where: and(eq(users.role, 'admin'), eq(users.status, 'active')),
      columns: { id: true, email: true, first_name: true, last_name: true },
    });
  } catch {
    admins = [];
  }

  // Fetch all admin notification prefs in parallel before the per-admin loop
  // to avoid one DB query per admin (N+1 pattern).
  const prefsMap = new Map(
    await Promise.all(
      admins.map(async (admin) => [admin.id, await getAdminNotificationPrefs(admin.id)] as const)
    )
  );

  await Promise.all(
    admins.map(async (admin) => {
      const prefs = prefsMap.get(admin.id)!;
      const channels = computeChannelPrefs(prefs, params.type);
      const spec: AdminEventSpec = {
        ...specBase,
        payload: params.payload ?? undefined,
      };

      if (channels.in_app) {
        try {
          await insertUserNotification({
            user_id: admin.id,
            kind: spec.kind,
            title: spec.title,
            body: spec.body,
            action_url: spec.action_url ?? null,
            payload: spec.payload ?? null,
          });
          await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'in_app', status: 'sent' });
        } catch {
          await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'in_app', status: 'failed' });
        }
      } else {
        await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'in_app', status: 'skipped' });
      }

      if (channels.push) {
        try {
          await sendPushNotification(admin.id, {
            title: spec.title,
            body: spec.body,
            data: {
              type: params.type,
              ...(params.stationId ? { station_id: params.stationId } : {}),
            },
          });
          await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'push', status: 'sent' });
        } catch {
          await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'push', status: 'failed' });
        }
      } else {
        await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'push', status: 'skipped' });
      }

      if (channels.email) {
        try {
          await sendAdminOperationalEmail({
            to: admin.email,
            adminName: [admin.first_name, admin.last_name].filter(Boolean).join(' ') || 'Admin',
            subject: spec.title,
            body: spec.body,
            actionUrl: spec.action_url ?? undefined,
          });
          await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'email', status: 'sent' });
        } catch {
          await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'email', status: 'failed' });
        }
      } else {
        await insertAuditLog({ userId: admin.id, stationId: params.stationId, event: params.type, type: 'email', status: 'skipped' });
      }
    })
  );
}
