const CACHE='wa-v23.2';
/* Install: skip waiting to activate immediately */
self.addEventListener('install',e=>{self.skipWaiting()});
/* Activate: purge old caches, claim all clients */
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
/* Fetch: network-first for HTML (always get latest app), cache-first for static assets */
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const isHTML=e.request.mode==='navigate'||url.pathname.endsWith('.html')||url.pathname==='/';
  if(isHTML){
    /* Network-first: try network, fall back to cache for offline */
    e.respondWith(fetch(e.request).then(res=>{if(res.status===200){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c))}return res}).catch(()=>caches.match(e.request)))
  }else{
    /* Cache-first for icons, manifests, etc */
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{if(res.status===200){const c=res.clone();caches.open(CACHE).then(ca=>ca.put(e.request,c))}return res})))
  }
});
