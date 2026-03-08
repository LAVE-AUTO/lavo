/**
 * Notification services (email, push, cron events). Stub implementation;
 * wire real Resend/email when integrating. Used by reservation and queue flows.
 */

export type NotifyEntryParams = {
  entryId: string;
  userId: string;
  stationId: string;
  type: 'reservation_created' | 'queue_joined' | 'moved_to_queue' | 'entry_cancelled' | 'invitation_to_rate';
  payload?: Record<string, unknown>;
};

/**
 * Sends a notification for an entry event. Stub: no-op. Replace with email/push when integrating.
 */
export async function notifyEntry(_params: NotifyEntryParams): Promise<void> {
  // Stub: no-op. Real implementation would enqueue or send email.
}

/**
 * Placeholder for notification services (legacy). Prefer notifyEntry.
 */
export function notificationServicePlaceholder() {
  // no-op; use notifyEntry for new flows
}

