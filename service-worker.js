// v1 no-op service worker:
// - no remote calendar fetches
// - no proxy fetches
// - no background sync behavior
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
