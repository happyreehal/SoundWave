/* ============================================================
   SERVICE WORKER — PWA Support
   Enables: Install prompt, offline cache, faster loads
============================================================ */

const CACHE_NAME = "soundwave-pro-v2";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/base.css",
  "./css/layout.css",
  "./css/player.css",
  "./css/components.css",
  "./css/animations.css",
  "./js/state.js",
  "./js/firebase.js",
  "./js/api.js",
  "./js/ui.js",
  "./js/player.js",
  "./js/features.js",
  "./js/app.js",
];

/* ─────────────────────────────────────────────
   INSTALL — Cache static assets
───────────────────────────────────────────── */
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static assets");
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn("[SW] Some assets failed to cache:", err);
      });
    })
  );
  self.skipWaiting();
});

/* ─────────────────────────────────────────────
   ACTIVATE — Clean old caches
───────────────────────────────────────────── */
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/* ─────────────────────────────────────────────
   FETCH — Network first, fallback to cache
   - HTML/JS/CSS: Network first (always fresh)
   - Images/Audio: Cache first (faster)
───────────────────────────────────────────── */
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ✅ Skip non-GET requests
  if (event.request.method !== "GET") return;

  // ✅ Skip API calls (backend, lyrics, iTunes, audius, saavn)
  if (
    url.hostname.includes("vercel.app") ||
    url.hostname.includes("itunes.apple.com") ||
    url.hostname.includes("lrclib.net") ||
    url.hostname.includes("audius.co") ||
    url.hostname.includes("saavn") ||
    url.hostname.includes("firebaseio.com") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("gstatic.com")
  ) {
    return; // Let browser handle directly
  }

  // ✅ Skip Chrome extensions
  if (url.protocol === "chrome-extension:") return;

  // Strategy: Cache-first for assets, Network-first for HTML
  const isHtml = event.request.headers.get("accept")?.includes("text/html");

  if (isHtml) {
    // Network first for HTML (always latest)
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match("./index.html")))
    );
  } else {
    // Cache first for assets (faster)
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            // Only cache successful responses
            if (response && response.status === 200 && response.type === "basic") {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {
            // Fallback for failed image requests
            if (event.request.destination === "image") {
              return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#242424" width="100" height="100"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" font-size="40">🎵</text></svg>',
                { headers: { "Content-Type": "image/svg+xml" } }
              );
            }
          });
      })
    );
  }
});

/* ─────────────────────────────────────────────
   MESSAGE — Communication from app
───────────────────────────────────────────── */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});