const CACHE_NAME = 'webclaw-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/logo.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // We want a network-first strategy for the agent to work,
  // falling back to cache if offline for the shell.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
