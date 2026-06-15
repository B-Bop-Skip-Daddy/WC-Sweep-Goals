/* Guess the Goals — service worker.
   Makes the app installable and loads the shell offline. Live ESPN data
   still goes to the network; we never cache that feed. */
const CACHE = "gtg-v3";
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
  if (url.origin !== self.location.origin) return;

  // The app's HTML: network-first, so a new deploy shows on a single refresh.
  // Falls back to the cached page when offline.
  const isHTML = req.mode === "navigate"
    || url.pathname.endsWith("/")
    || url.pathname.endsWith(".html");
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match("./index.html")))
    );
    return;
  }

  // Other shell assets (icons, manifest): cache-first, refresh in background.
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
});
