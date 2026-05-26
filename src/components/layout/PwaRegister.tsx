'use client';

import { useEffect } from 'react';

/* Registers the service worker on first client render.
 * Runs only in production to avoid interfering with Turbopack HMR in dev.
 *
 * Also listens for SW_UPDATED messages from the new service worker and for
 * the 'controllerchange' event so the page auto-reloads when a new deployment
 * is detected. This prevents the stale-UI pattern where skipWaiting() + claim()
 * gives the new SW control of the tab but the tab is still running old HTML/JS. */
export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    // Capture whether a SW was already controlling this page before registration.
    // Used to distinguish a first-time SW install (no reload needed) from an update.
    const hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        /* SW registration failure is non-fatal */
      });

    // The new SW posts SW_UPDATED after it activates and clears old caches.
    // Reload so the browser fetches fresh HTML (network-first) and new JS chunks.
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        window.location.reload();
      }
    };

    // Belt-and-suspenders: also reload on controllerchange in case the message
    // is missed (e.g. the tab was not yet controlled when the message was sent).
    const onControllerChange = () => {
      if (hadController) {
        window.location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  return null;
}
