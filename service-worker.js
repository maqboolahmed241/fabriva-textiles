const CACHE_NAME = "maryam-luxe-shell-v9";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=shop-now-2",
  "./store.js",
  "./home-catalog.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./shop.html",
  "./shop.css",
  "./shop.css?v=rtl-shop-fix-1",
  "./shop.js",
  "./shop.js?v=collection-route-fix-1",
  "./config.js",
  "./cart-validation.js",
  "./visitor-tracker.js",
  "./visitor-tracker.js?v=1",
  "./contact-widget.js",
  "./contact-widget.js?v=1"
];

async function cachedPage(request) {
  return await caches.match(request, { ignoreSearch: true }) || null;
}

async function isUsableDocument(response) {
  if (!response || !response.ok) return false;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return false;
  try {
    const html = await response.clone().text();
    return html.length > 500 && /<body[\s>]/i.test(html) && /<\/html>/i.test(html);
  } catch {
    return false;
  }
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const url = new URL(request.url);
      const isShopShell = url.pathname.endsWith("/shop.html");
      // Serve the already-cached shop shell immediately so collection navigation
      // never flashes a blank page while GitHub Pages is responding.
      if (isShopShell) {
        const cached = await cachedPage(request);
        if (cached) {
          fetch(request).then(async response => {
            if (await isUsableDocument(response)) {
              const cache = await caches.open(CACHE_NAME);
              await cache.put(new Request(url.origin + url.pathname), response.clone());
            }
          }).catch(() => {});
          return cached;
        }
      }
      try {
        const response = await fetch(request);
        if (await isUsableDocument(response)) {
          const cache = await caches.open(CACHE_NAME);
          const key = new Request(url.origin + url.pathname);
          await cache.put(key, response.clone());
          return response;
        }
      } catch {
        // Use the last known good page below.
      }
      const fallback = await cachedPage(request);
      const fallbackHtml = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MARYAM LUXE</title></head>
<body style="font:16px Arial;padding:24px;color:#282722"><h1>MARYAM LUXE</h1><p>The page is temporarily unavailable. Please refresh.</p></body>
</html>`;
      return fallback || new Response(
        fallbackHtml,
        { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 200 }
      );
    })());
    return;
  }

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return response;
    }).catch(() => caches.match(request, { ignoreSearch: true }).then(cached => cached || Response.error()))
  );
});
