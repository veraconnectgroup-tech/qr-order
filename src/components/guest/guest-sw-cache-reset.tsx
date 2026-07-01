"use client";

import { useEffect } from "react";
import {
  clearStaleGuestSwCaches,
  unregisterGuestServiceWorkers,
} from "@/lib/pwa/clear-guest-sw-cache";
import { clearGuestMenuCacheForLocation } from "@/lib/pwa/menu-cache";

/** Bump when guest must hard-reset SW caches (stale CSS / unstyled menu after deploy). */
const RESET_VERSION = "v4";
const RESET_STORAGE_KEY = `guest-sw-reset-${RESET_VERSION}`;
const DEPLOY_VERSION_KEY = "guest-deploy-version";

function isGuestTableQrRoute(): boolean {
  if (typeof window === "undefined") return false;
  const parts = window.location.pathname.split("/").filter(Boolean);
  return parts.length >= 2;
}

/**
 * Guest QR must never run the staff PWA service worker — it caches old /_next/static
 * CSS hashes and leaves the menu unstyled after deploy.
 */
export function GuestSwCacheReset() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; locationId?: string } | null;
      if (data?.type === "INVALIDATE_MENU_CACHE" && data.locationId) {
        clearGuestMenuCacheForLocation(data.locationId);
      }
    }

    navigator.serviceWorker?.addEventListener("message", onMessage);

    void (async () => {
      const deepLinkTableRoute = isGuestTableQrRoute();

      const hadServiceWorker =
        typeof navigator !== "undefined" &&
        "serviceWorker" in navigator &&
        (await navigator.serviceWorker.getRegistrations()).length > 0;

      if (hadServiceWorker) {
        await unregisterGuestServiceWorkers();
        await clearStaleGuestSwCaches({ aggressive: true });
      }

      let deployVersion: string | undefined;
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = (await res.json()) as { version?: string };
        deployVersion = json.version;
      } catch {
        // Offline — still apply one-time reset below if needed.
      }

      const storedDeploy = localStorage.getItem(DEPLOY_VERSION_KEY);
      if (deployVersion && storedDeploy && storedDeploy !== deployVersion) {
        await clearStaleGuestSwCaches({ aggressive: true });
        localStorage.setItem(DEPLOY_VERSION_KEY, deployVersion);
        if (!deepLinkTableRoute) {
          window.location.reload();
        }
        return;
      }

      if (deployVersion) {
        localStorage.setItem(DEPLOY_VERSION_KEY, deployVersion);
      }

      if (!localStorage.getItem(RESET_STORAGE_KEY)) {
        localStorage.setItem(RESET_STORAGE_KEY, "1");
        await clearStaleGuestSwCaches({ aggressive: true });
        if (!deepLinkTableRoute) {
          window.location.reload();
        }
      }
    })();

    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, []);

  return null;
}
