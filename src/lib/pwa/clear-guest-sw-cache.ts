const STALE_CACHE_PREFIXES = [
  "workbox-precache",
  "workbox-runtime",
  "next-static",
  "start-url",
  "pages",
  "api-cache",
  "dashboard-pages",
  "menu-data",
];

/** Drop SW caches that pin stale HTML/CSS after deploy (guest QR must never use old bundles). */
export async function clearStaleGuestSwCaches(options?: {
  aggressive?: boolean;
}): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;

  const keys = await caches.keys();
  const targets = options?.aggressive
    ? keys
    : keys.filter((key) =>
        STALE_CACHE_PREFIXES.some(
          (prefix) => key === prefix || key.startsWith(`${prefix}-`)
        )
      );

  await Promise.all(targets.map((key) => caches.delete(key)));
}

export async function unregisterGuestServiceWorkers(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}
