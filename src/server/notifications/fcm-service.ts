/**
 * Firebase Cloud Messaging (FCM) service.
 * Sends push notifications to all registered devices for a user.
 *
 * Requirements:
 *   - npm install firebase-admin  (if not yet installed)
 *   - Env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *
 * Fallback: if FIREBASE_PROJECT_ID is absent or empty the service falls back to
 * stub behavior (logs the intent, no crash) so the rest of the application
 * continues to work in development and CI without Firebase credentials.
 *
 * After a multicast send, tokens that FCM reports as
 * 'registration-token-not-registered' are automatically removed from the
 * device_tokens table to keep the stored token set clean.
 */
import admin from 'firebase-admin';

import { getTokensForUser, removeExpiredTokens } from './device-token-service';


// %%%%% Types %%%%%
// Push notification payload

export type PushNotificationPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};


// %%%%% Constants %%%%%
// FCM configuration and error codes

/** FCM error code returned when a token is no longer valid. */
const INVALID_TOKEN_ERROR = 'messaging/registration-token-not-registered';


// %%%%% Firebase initialization %%%%%
// Lazy initialization and configuration

/**
 * Returns true when Firebase is configured via environment variables.
 */
function isFirebaseConfigured(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID);
}

/**
 * Lazily initializes the Firebase Admin app (only once per process).
 * Reads credentials from environment variables.
 * The private key is expected to use literal '\n' escape sequences
 * (as set in most CI/hosting environments) and they are replaced with
 * real newlines before passing to the SDK.
 */
function getFirebaseApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}


// %%%%% Send notifications %%%%%
// Push notification dispatch and token cleanup

/**
 * Sends a push notification to all registered devices for the given user.
 *
 * Steps:
 *   1. Query all FCM tokens for the user from the device_tokens table.
 *   2. If no tokens are registered, return early.
 *   3. Send a multicast message via FCM.
 *   4. Remove any tokens that FCM reports as invalid/expired.
 *
 * If Firebase is not configured (FIREBASE_PROJECT_ID absent), falls back to
 * stub behavior: logs the intent and returns without making any network call.
 *
 * @param userId  - UUID of the target user
 * @param payload - Notification title, body, and optional key/value data
 */
export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  if (!isFirebaseConfigured()) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        '[FCM] FIREBASE_PROJECT_ID is not set — falling back to stub. ' +
          `Notification skipped for user ${userId}: "${payload.title}"`
      );
    }
    return;
  }

  const tokens = await getTokensForUser(userId);

  if (tokens.length === 0) {
    return;
  }

  const app = getFirebaseApp();
  const messaging = app.messaging();

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    ...(payload.data && { data: payload.data }),
  };

  let response: admin.messaging.BatchResponse;
  try {
    response = await messaging.sendEachForMulticast(message);
  } catch (err) {
    console.error('[FCM] sendEachForMulticast failed:', err);
    return;
  }

  // Collect tokens that FCM flagged as invalid so they can be removed.
  const expiredTokens: string[] = [];
  response.responses.forEach((result, index) => {
    if (
      !result.success &&
      result.error?.code === INVALID_TOKEN_ERROR
    ) {
      expiredTokens.push(tokens[index]);
    }
  });

  if (expiredTokens.length > 0) {
    try {
      await removeExpiredTokens(expiredTokens);
    } catch (err) {
      // Non-fatal: stale tokens remain but will be cleaned up on the next send.
      console.error('[FCM] Failed to remove expired tokens:', err);
    }
  }
}
