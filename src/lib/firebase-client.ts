/**
 * Firebase client-side SDK initialization.
 *
 * Singleton: the app and messaging instances are created only once per browser
 * process. All environment variables are read from the NEXT_PUBLIC_* prefix
 * so they are available in the browser bundle.
 *
 * Guard: the entire module resolves to null on the server side (SSR/RSC)
 * because Firebase Messaging requires the browser environment.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getMessaging, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isFirebaseConfigured(): boolean {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let messagingInstance: Messaging | null = null;

/**
 * Returns the Firebase Messaging instance for the browser.
 * Returns null on the server or when the env vars are not set.
 */
export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') return null;
  if (!isFirebaseConfigured()) return null;

  if (messagingInstance) return messagingInstance;

  try {
    const app: FirebaseApp =
      getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    messagingInstance = getMessaging(app);
    return messagingInstance;
  } catch {
    // Firebase unavailable (e.g. browser blocks service workers)
    return null;
  }
}
