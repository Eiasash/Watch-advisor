const CACHE = "wa-v25.5";
const MODULES = [
  "./", "./index.html",
  "./app.js", "./data.js", "./engine.js",
  "./utils.js", "./ai.js", "./photos.js", "./crypto.js"
];

/* Install: cache critical assets, force takeover */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(MODULES))
      .then(() => self.skipWaiting())
  );
});

/* Activate: nuke ALL old caches, claim clients immediately */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(
        ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(() => {
        return self.clients.matchAll({ type: "window" }).then((cls) => {
          cls.forEach((c) => c.postMessage({ type: "SW_ACTIVATED", cache: CACHE }));
        });
      })
  );
});

/* Message handlers */
self.addEventListener("message", (e) => {
  if (!e.data) return;
  if (e.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (e.data.type === "CLEAR_ALL_CACHES") {
    caches.keys().then((ks) =>
      Promise.all(ks.map((k) => caches.delete(k)))
    ).then(() => {
      self.clients.matchAll({ type: "window" }).then((cls) => {
        cls.forEach((c) => c.postMessage({ type: "CACHES_CLEARED" }));
      });
    });
  }
  if (e.data.type === "GET_VERSION") {
    e.source.postMessage({ type: "SW_VERSION", cache: CACHE });
  }
});

/* Fetch strategy:
   Navigations + app code → NETWORK-FIRST (never serve stale shell)
   Static assets → cache-first with network fallback */
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const isNavigation = e.request.mode === "navigate";
  const isAppCode =
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith("/");
  if (isNavigation || isAppCode) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    e.respondWith(
      caches.match(e.request).then((r) =>
        r || fetch(e.request).then((res) => {
          if (res.status === 200) {
            const c = res.clone();
            caches.open(CACHE).then((ca) => ca.put(e.request, c));
          }
          return res;
        })
      )
    );
  }
});
