/*
 * Pinged — offline support.
 * The page shell is cached on install. This site's own files are fetched from the network first,
 * so a new deploy shows up straight away, and fall back to the cache when you're offline.
 * The code-colour script from its CDN is cached as it's used and refreshed in the background.
 * Live status, the experiment feed and pictures from other sites always go to the network.
 * Bump VERSION when the SHELL list changes, so the old cache is dropped.
 */
const VERSION = "pinged-v2";
const SHELL = [
  "./", "index.html", "manifest.webmanifest", "css/fonts.css", "css/style.css", "assets/fonts/bricolage-grotesque.woff2",
  "js/markdown.js", "js/content.js", "js/live.js", "js/embed.js", "js/snapshot.js", "js/discord.js", "js/app.js",
  "assets/logo.svg",
];
const CDN_HOSTS = ["cdnjs.cloudflare.com"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (CDN_HOSTS.includes(url.hostname)) e.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) || (req.mode === "navigate" ? cache.match("index.html") : Response.error());
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(req);
  const fresh = fetch(req).then((res) => {
    // Opaque responses are cross-origin scripts: usable, just unreadable.
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  });
  if (cached) {
    fresh.catch(() => { /* offline: the cached copy was already served */ });
    return cached;
  }
  return fresh;
}
