'use client';

import { useEffect } from 'react';

/* Registers the service worker on first client render.
 * Runs only in production to avoid interfering with Turbopack HMR in dev. */
export function PwaRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== 'production' ||
      !('serviceWorker' in navigator)
    ) {
      return;
    }

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        /* SW registration failure is non-fatal */
      });
  }, []);

  return null;
}
