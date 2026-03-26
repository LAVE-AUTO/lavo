/**
 * Firebase Cloud Messaging (FCM) service stub.
 * Sends push notifications to user devices via FCM.
 *
 * To wire real FCM:
 *   1. npm install firebase-admin
 *   2. Set env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   3. Initialize firebase-admin app and replace sendPushNotification with real implementation.
 *   4. Add a device_tokens table (user_id, token, platform, created_at) to store FCM tokens.
 *      Register tokens via POST /me/device-token when the mobile app starts.
 *
 * Current state: logs the intent; no-op until Firebase is configured.
 */

export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * Sends a push notification to all registered devices for the given user.
 * Stub: logs the intent. Replace with firebase-admin messaging when configured.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  // TODO: look up device tokens for userId from device_tokens table
  // TODO: call firebase-admin messaging.sendEachForMulticast(tokens, payload)
  if (process.env.NODE_ENV !== "production") {
    console.info(`[FCM stub] → user ${userId}: "${payload.title}" — ${payload.body}`);
  }
}
