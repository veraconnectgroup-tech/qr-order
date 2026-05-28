"use client";

import { useEffect } from "react";
import {
  clearStaleGuestSwCaches,
  unregisterGuestServiceWorkers,
} from "@/lib/pwa/clear-guest-sw-cache";

/** Bump when guest must hard-reset SW caches (stale CSS / unstyled menu after deploy). */
const RESET_VERSION = "v3";
const RESET_STORAGE_KEY = `guest-sw-reset-${RESET_VERSION}`;

/**
 * Guest QR must never run the staff PWA service worker — it caches old /_next/static
 * CSS hashes and leaves the menu unstyled after deploy.
 */
export function GuestSwCacheReset() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    void (async () => {
      await unregisterGuestServiceWorkers();
      await clearStaleGuestSwCaches({ aggressive: true });

      if (localStorage.getItem(RESET_STORAGE_KEY)) return;

      localStorage.setItem(RESET_STORAGE_KEY, "1");
      window.location.reload();
    })();
  }, []);

  return null;
}
