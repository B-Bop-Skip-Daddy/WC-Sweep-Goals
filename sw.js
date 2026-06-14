/* Guess the Goals — service worker.
   Makes the app installable and loads the shell offline. Live ESPN data
   still goes to the network; we never cache that feed. */
const CACHE = "gtg-v1";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  "./favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the live data feed — always go to network.
  if (url.hostname.includes("espn.com")) return;

  // App shell: cache-first, then update in the background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(cached => {
        const live = fetch(req).then(res => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || live;
      })
    );
  }
});
