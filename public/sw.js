/* 
 * XY Cargo PWA Service Worker 
 * Enhanced with support for notifications, background sync, and robust caching.
 */

const CACHE_NAME = "xy-cargo-pwa-v4";
const APP_SHELL_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/manifest.webmanifest",
  "/favicon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-icon-192.png",
  "/icons/maskable-icon-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/screenshot-wide.png",
  "/icons/screenshot-narrow.png",
  "/icons/splash.png",
  "/icons/splash-640x1136.png",
  "/icons/splash-750x1334.png",
  "/icons/splash-1125x2436.png",
  "/icons/splash-1242x2688.png",
  "/icons/splash-1536x2048.png",
  "/icons/splash-1668x2224.png",
  "/icons/splash-2048x2732.png"
];

const OFFLINE_URL = "/index.html";

// Utility to check origin
const isSameOrigin = (requestUrl) => requestUrl.origin === self.location.origin;

// Cache a response
const cacheResponse = async (request, response) => {
  if (!response || response.status !== 200 || response.type === "opaque") return response;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response.clone());
  return response;
};

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Pre-caching app shell");
      return cache.addAll(APP_SHELL_URLS);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== CACHE_NAME)
          .map((cacheName) => {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          })
      )
    )
  );
  self.clients.claim();
});

// Message Handling
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  
  // Skip cross-origin requests unless they are assets we want to cache
  if (!isSameOrigin(url)) {
    // Optional: add logic for specific CDNs if needed
    return;
  }

  // Navigation requests: Network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (await cache.match(OFFLINE_URL)) || Response.error();
        })
    );
    return;
  }

  // Static assets: Cache-first, then network (stale-while-revalidate)
  if (/\.(?:js|css|png|jpg|jpeg|svg|webp|ico|woff2?)$/i.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => cacheResponse(event.request, response))
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  // API or other requests: Network-first
  event.respondWith(
    fetch(event.request)
      .then((response) => cacheResponse(event.request, response))
      .catch(() => caches.match(event.request))
  );
});

// Notification Events
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "XY Cargo Update";
  const options = {
    body: data.body || "A new update is available in your cargo portal.",
    icon: "/icons/icon-192.png",
    badge: "/icons/favicon.png",
    vibrate: [100, 50, 100],
    data: {
      url: data.url || "/"
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      const url = event.notification.data.url;
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// Background Sync
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-shipments") {
    console.log("[SW] Syncing shipments...");
    // Logic for background sync would go here
  }
});
