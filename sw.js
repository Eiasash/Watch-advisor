const CACHE = "wa-v24.13";
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
/* Listen for SKIP_WAITING from app's "Update now" button */
self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
/* Fetch strategy:
   HTML navigations → network-first (always get latest, fall back to cache)
   Other → cache-first with network fallback */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isNav =
    e.request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");
  if (isNav) {
    /* NETWORK-FIRST: always try to get fresh HTML */
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request)),
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
