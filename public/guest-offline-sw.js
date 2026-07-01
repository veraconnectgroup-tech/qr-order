const MENU_CACHE = "menu-data";
const STATIC_CACHE = "guest-static";

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response.ok) {
        void cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    void networkFetch;
    return cached;
  }

  const fresh = await networkFetch;
  return fresh ?? Response.error();
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    if (
      request.method === "GET" &&
      /\/rest\/v1\/(products|categories)(\/|\?|$)/i.test(url.pathname)
    ) {
      event.respondWith(staleWhileRevalidate(request, MENU_CACHE));
    }
    return;
  }

  if (request.method === "POST" && url.pathname.startsWith("/api/orders")) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.method !== "GET") return;

  if (url.pathname.startsWith("/api/health")) {
    event.respondWith(fetch(request));
    return;
  }

  if (/\.(png|jpg|jpeg|svg|gif|webp|woff2?)$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
  }
});
