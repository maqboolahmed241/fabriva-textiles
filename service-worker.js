const CACHE_NAME = "maryam-luxe-shell-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./store.js",
  "./home-catalog.js",
  "./manifest.webmanifest",
  "./icons/icon.svg"
];

async function cachedPage(request) {
  const exact = await caches.match(request);
  if (exact) return exact;
  return caches.match("./index.html");
}

async function isUsableDocument(response) {
  if (!response || !response.ok) return false;
  const type = response.headers.get("content-type") || "";
  if (!type.includes("text/html")) return false;
  try {
    const html = await response.clone().text();
    return html.length > 500 && /<body[\\s>]/i.test(html) && /<\\/html>/i.test(html);
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
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (await isUsableDocument(response)) {
          const page = response.clone();
          const url = new URL(request.url);
          if (url.pathname.endsWith("/") || url.pathname.endsWith("/index.html")) {
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", page)).catch(() => {});
          }
          return response;
        }
      } catch (error) {
        // Use the last known good page when the network is unavailable.
      }
      const fallback = await cachedPage(request);
      return fallback || new Response(
        "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>MARYAM LUXE</title><body style=\"font:16px Arial;padding:24px;color:#282722\"><h1>MARYAM LUXE</h1><p>The page is temporarily unavailable. Please check your connection and refresh.</p></body></html>",
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
    }).catch(() => caches.match(request).then(cached => cached || Response.error()))
  );
});
