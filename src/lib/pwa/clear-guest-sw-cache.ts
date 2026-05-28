const STALE_CACHE_PREFIXES = [
  "workbox-precache",
  "workbox-runtime",
  "next-static",
  "start-url",
];

export async function clearStaleGuestSwCaches(): Promise<void> {
  if (typeof window === "undefined" || !("caches" in window)) return;

  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) =>
        STALE_CACHE_PREFIXES.some(
          (prefix) => key === prefix || key.startsWith(`${prefix}-`)
        )
      )
      .map((key) => caches.delete(key))
  );
}

export async function unregisterGuestServiceWorkers(): Promise<void> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
}
