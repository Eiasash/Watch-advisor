const CACHE = "wa-v24.9";
/* Install: cache critical assets, activate immediately */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["./", "./index.html"]))
      .then(() => self.skipWaiting()),
  );
});
/* Activate: purge old caches, claim all clients */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((ks) =>
        Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});
/* Fetch strategy:
   HTML → stale-while-revalidate (instant load, background update)
   Other → cache-first with network fallback */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isHTML =
    e.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname === "/";
  if (isHTML) {
    /* STALE-WHILE-REVALIDATE: return cache immediately, update in background */
    e.respondWith(
      caches.open(CACHE).then((cache) => {
        return cache.match(e.request).then((cached) => {
          const fetchPromise = fetch(e.request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                cache.put(e.request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cached);
          /* Return cached response immediately if available, otherwise wait for network */
          return cached || fetchPromise;
        });
      }),
    );
  } else {
    /* Cache-first for static assets */
    e.respondWith(
      caches.match(e.request).then(
        (r) =>
          r ||
          fetch(e.request).then((res) => {
            if (res.status === 200) {
              const c = res.clone();
              caches.open(CACHE).then((ca) => ca.put(e.request, c));
            }
            return res;
          }),
      ),
    );
  }
});
