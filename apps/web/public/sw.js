/* global self, caches */
/*
 * Globetrot offline reading (ADR-0027). Keeps the last version of the current trip's screens and the app's
 * static files, so a trip can be read without a connection. Only these pages are touched; everything else
 * (the API, sign-in, other pages) goes straight to the network. Signing out empties the cache.
 */
const CACHE = 'globetrot-trip-v2';
const TRIP_PAGES = ['/app/today', '/app/trip', '/app/board', '/app/budget', '/app/lists'];
const NETWORK_TIMEOUT_MS = 6000;
/** Set on sign-out: from then on this worker saves nothing and steps aside. */
let stopped = false;

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const type = event.data && event.data.type;
  if (type === 'clear') {
    stopped = true;
    event.waitUntil(caches.delete(CACHE));
  }
  if (type === 'warm') {
    // Saves every trip screen now, so all of them work offline, not only the ones opened.
    event.waitUntil(
      caches.open(CACHE).then((cache) =>
        Promise.all(
          TRIP_PAGES.map((path) =>
            fetch(path, { credentials: 'same-origin' })
              .then((response) => (response.ok ? cache.put(path, response) : undefined))
              .catch(() => undefined),
          ),
        ),
      ),
    );
  }
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (stopped || request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/_next/static/')) {
    // Fingerprinted files never change: the cache first.
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === 'navigate' && TRIP_PAGES.includes(url.pathname)) {
    // The network first, so the page is always fresh online; the saved copy when it does not answer.
    event.respondWith(
      withTimeout(fetch(request), NETWORK_TIMEOUT_MS)
        .then((response) => {
          if (response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(url.pathname, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(url.pathname)
            .then(
              (hit) =>
                hit ||
                new Response('Offline', { status: 503, headers: { 'content-type': 'text/plain' } }),
            ),
        ),
    );
  }
});
