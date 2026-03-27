/* ------------------------------------------------------------------
 *  Slowtime — Service Worker
 *  Scope: /
 *  Strategy: network-first for API/navigation, cache-first for static assets.
 * ------------------------------------------------------------------ */

const CACHE_NAME = 'slowtime-v1';

/* Static assets to pre-cache on install */
const PRECACHE_URLS = [
  '/',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/* ------------------------------------------------------------------ */
/*  Install — pre-cache static shell                                   */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

/* ------------------------------------------------------------------ */
/*  Activate — purge old caches                                        */
/* ------------------------------------------------------------------ */

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

/* ------------------------------------------------------------------ */
/*  Fetch — network-first for navigation + API, cache-first for assets */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Only handle same-origin requests */
  if (url.origin !== self.location.origin) return;

  /* Skip API routes — never cache them */
  if (url.pathname.startsWith('/api/')) return;

  /* Static assets: cache-first */
  if (
    request.destination === 'image' ||
    request.destination === 'font' ||
    request.destination === 'style' ||
    request.destination === 'script'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          }),
      ),
    );
    return;
  }

  /* Navigation: network-first, fall back to cached if offline */
  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});

/* ------------------------------------------------------------------ */
/*  Push notifications (FCM)                                           */
/*  TODO: import Firebase scripts and configure once NEXT_PUBLIC_FIREBASE_*
 *  env vars are available. See .env.example for FIREBASE_SERVER_KEY.
 *
 *  Required steps when Firebase is ready:
 *    1. Add NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID,
 *       NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID
 *       and NEXT_PUBLIC_FIREBASE_VAPID_KEY to .env.
 *    2. Replace the stub below with:
 *       importScripts('https://www.gstatic.com/firebasejs/<version>/firebase-app-compat.js');
 *       importScripts('https://www.gstatic.com/firebasejs/<version>/firebase-messaging-compat.js');
 *       firebase.initializeApp({ ... });
 *       const messaging = firebase.messaging();
 *       messaging.onBackgroundMessage((payload) => {
 *         self.registration.showNotification(payload.notification.title, {
 *           body: payload.notification.body,
 *           icon: '/icons/icon-192x192.png',
 *         });
 *       });
 * ------------------------------------------------------------------ */

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'Slowtime', body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Slowtime', {
      body: data.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) return clients[0].focus();
      return self.clients.openWindow('/');
    }),
  );
});
