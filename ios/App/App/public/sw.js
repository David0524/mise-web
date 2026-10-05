// Minimal service worker: installability plus a few static assets cached for a
// faster start. Pages and API responses are NEVER cached.
//
// The previous version pre-cached "/app" at install time. Install happens on a
// visitor's first page view — almost always the landing page, logged out — so
// what it stored was the redirect to /login. Serving that redirected response
// to a later navigation is something browsers refuse outright, so every
// reload, bookmark and home-screen launch of /app failed with "This site can't
// be reached". The cached copy also outlived the auth and paywall checks /app
// exists to perform, and would have outlived each deploy's script bundle.
// Bumping the cache name removes the old entries on activate.
const SHELL_CACHE = "mise-static-v2";
const STATIC_FILES = ["/manifest.json", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(STATIC_FILES)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== SHELL_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  // Navigations (every page, including /app) always go to the network so the
  // server's auth and paywall checks run on every load.
  if (req.mode === "navigate") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !STATIC_FILES.includes(url.pathname)) return;

  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
