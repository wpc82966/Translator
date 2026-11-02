// service-worker.js — AllSpeak Voice Translator
// Updated: 2026-11-02 — network-first for app shell so new uploads show up
// automatically on every device; no more manual cache-version bumps needed.

const CACHE_NAME = 'allspeak-v5';
const STATIC_ASSETS = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) => c.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;            // API POSTs go straight to network
  const url = new URL(req.url);
  if (url.hostname === 'api.anthropic.com') return;

  const isShell = url.origin === self.location.origin &&
    (req.mode === 'navigate' || /\/(index\.html|manifest\.json)?$/.test(url.pathname));

  if (isShell) {
    // Network-first: always try GitHub for the latest, fall back to cache offline
    event.respondWith(
      fetch(req).then((res) => {
        if (res.ok) caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // Everything else (fonts, flag CSS, icons): stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
