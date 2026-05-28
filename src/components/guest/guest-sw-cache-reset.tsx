"use client";

import { useEffect } from "react";
import {
  clearStaleGuestSwCaches,
  unregisterGuestServiceWorkers,
} from "@/lib/pwa/clear-guest-sw-cache";

const RESET_SESSION_KEY = "guest-sw-reset-v2";

/** One-time purge of stale PWA caches that pinned pre-Denis guest bundles on iOS. */
export function GuestSwCacheReset() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (sessionStorage.getItem(RESET_SESSION_KEY)) return;

    void (async () => {
      await unregisterGuestServiceWorkers();
      await clearStaleGuestSwCaches();
      sessionStorage.setItem(RESET_SESSION_KEY, "1");
      window.location.reload();
    })();
  }, []);

  return null;
}
