'use client';

/**
 * useFcmToken — silent FCM device-token registration hook.
 *
 * Behaviour:
 *   - Runs only when the user is authenticated as a client.
 *   - Requests notification permission once per browser session.
 *     If the user denies, the hook exits silently without error.
 *   - Retrieves the FCM token and POSTs it to POST /api/v1/me/device-token.
 *   - Uses sessionStorage to guarantee the registration call is made at most
 *     once per tab session, regardless of how often the component re-renders.
 *   - Never throws or blocks rendering.
 */

import { useEffect, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { useAuth } from '@/context';
import { postWithApi } from '@/services/axios-service';
import { getFirebaseMessaging } from '@/lib/firebase-client';

const SESSION_KEY = 'fcm_token_registered';

export function useFcmToken(): void {
  const { isAuthenticated, isClient, isLoading } = useAuth();
  const attemptedRef = useRef(false);

  useEffect(() => {
    // Wait until auth state is resolved
    if (isLoading) return;

    // Only register for authenticated client users
    if (!isAuthenticated || !isClient) return;

    // Avoid re-running in the same tab session or after a StrictMode double-invoke
    if (attemptedRef.current) return;
    if (typeof window !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) return;

    attemptedRef.current = true;

    void (async () => {
      try {
        // FCM requires a service worker — bail out if unavailable
        if (!('serviceWorker' in navigator)) return;

        const messaging = getFirebaseMessaging();
        if (!messaging) return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: await navigator.serviceWorker.ready,
        });

        if (!token) return;

        await postWithApi('/me/device-token', {
          token,
          platform: 'web' as const,
        });

        // Mark as done for the lifetime of this tab
        sessionStorage.setItem(SESSION_KEY, '1');
      } catch {
        // Notification registration is optional; never surface errors to the UI
      }
    })();
  }, [isLoading, isAuthenticated, isClient]);
}
