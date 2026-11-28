'use strict';

const CACHE_NAME = 'life-planner-v13';
const ASSETS = Array.of(
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/main.js',
  './js/store.js',
  './js/sound.js',
  './js/timer.js',
  './js/builder.js',
  './js/today.js',
  './js/planner.js',
  './js/stats.js',
  './js/backup.js',
  './js/tg-push.js',
  './js/platform.js',
  './js/i18n.js',
  './js/dict.js'
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});
