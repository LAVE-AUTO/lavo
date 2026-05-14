/* ------------------------------------------------------------------
 *  Slowtime - Service Worker
 *  Scope: /
 *  Strategy: network-first for API/navigation, cache-first for static assets.
 * ------------------------------------------------------------------ */

const CACHE_NAME = 'slowtime-v2';

/* Static assets to pre-cache on install */
const PRECACHE_URLS = [
  '/',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

/* ------------------------------------------------------------------ */
/*  Install - pre-cache static shell                                   */
/* ------------------------------------------------------------------ */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)),
  );
  self.skipWaiting();
});

/* ------------------------------------------------------------------ */
/*  Activate - purge old caches                                        */
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
/*  Fetch - network-first for navigation + API, cache-first for assets */
/* ------------------------------------------------------------------ */

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* Only handle same-origin requests */
  if (url.origin !== self.location.origin) return;

  /* Never cache Next build assets/chunks - avoids stale UI logic after deploy/reload. */
  if (url.pathname.startsWith('/_next/')) return;

  /* Skip API routes - never cache them */
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
/*  Firebase Cloud Messaging - background message handler              */
/*  Handles push notifications when the app tab is in the background.  */
/*  Uses the compat build so it can be loaded via importScripts.       */
/* ------------------------------------------------------------------ */

importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.12.0/firebase-messaging-compat.js');

// These are the NEXT_PUBLIC_FIREBASE_* values - all non-secret client identifiers.
// Service workers cannot access process.env, so the values are inlined here.
firebase.initializeApp({
  apiKey: 'AIzaSyCBFjrozYd9QQpZejqWG6ogqjv4HHWqajE',
  authDomain: 'Hurryline-e19b8.firebaseapp.com',
  projectId: 'Hurryline-e19b8',
  messagingSenderId: '699133261235',
  appId: '1:699133261235:web:5fc63b300714bc1bab07c6',
});

const messaging = firebase.messaging();

/**
 * onBackgroundMessage fires when a push message arrives while the app
 * is either in the background or the tab is closed.
 * FCM will NOT automatically show a notification in this case - we must
 * call showNotification ourselves.
 */
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Hurryline';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
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
