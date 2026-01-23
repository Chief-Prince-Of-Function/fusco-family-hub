// Minimal SW: cache shell for quick loads, but always fetch hub.json fresh.
const CACHE = "ffh-shell-v1";
const SHELL = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/favicon-32.png",
  "./assets/favicon.ico"
];

self.addEventListener("install", (event)=>{
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(()=> self.skipWaiting())
  );
});

self.addEventListener("activate", (event)=>{
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event)=>{
  const url = new URL(event.request.url);

  // Always get latest data
  if(url.pathname.endsWith("/data/hub.json") || url.pathname.endsWith("data/hub.json")){
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(hit => hit || fetch(event.request))
  );
});
