const CACHE_NAME = "maryam-luxe-shell-v25";
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
  "./shop.css?v=android-rtl-viewport-guard-2",
  "./shop.js",
  "./shop.js?v=clean-startup-2",
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

  // Let the browser handle document navigations directly. The previous
  // navigation interception could serve a stale or incomplete document on
  // some mobile browsers. Static assets remain cached below for offline use.
  if (request.mode === "navigate") return;

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
