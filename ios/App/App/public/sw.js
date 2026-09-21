// Minimal service worker: caches the app shell so it opens instantly and
// degrades gracefully offline, without trying to cache API responses (those
// are per-user and change every call — caching them would show stale data).
const SHELL_CACHE = "mise-shell-v1";
const SHELL_FILES = ["/app", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).catch(() => {})
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
  // Never intercept API calls or Stripe/auth requests — those must always
  // hit the network, or a paywall check could pass on stale cached data.
  if (event.request.url.includes("/api/")) return;
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
