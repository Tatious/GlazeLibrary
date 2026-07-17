/**
 * Service worker for the Glaze Library PWA.
 *
 * Kept intentionally minimal and update-safe:
 *  - Navigations (HTML) are network-first, so online users always get the
 *    latest app shell; the cached shell is only used as an offline fallback.
 *  - Same-origin static assets (content-hashed JS/CSS, icons) are cache-first
 *    — their filenames change on every deploy, so cached copies never go stale.
 *  - API, uploads and cross-origin (CDN, Firebase) requests are never touched.
 *
 * Registered from src/main.tsx in production only.
 */
const CACHE = "glaze-shell-v1";
const SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // CDN images, Firebase, etc.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/")
  ) {
    return; // never cache dynamic API responses or user uploads
  }

  // Network-first for page navigations so content is always fresh when online.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put("/", copy))
            .catch(() => {});
          return res;
        })
        .catch(() =>
          caches.match("/").then((cached) => cached || caches.match(request)),
        ),
    );
    return;
  }

  // Cache-first for immutable, same-origin static assets.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(request, copy))
              .catch(() => {});
          }
          return res;
        }),
    ),
  );
});
