"use client";

import { useEffect } from "react";
import {
  clearStaleGuestSwCaches,
  unregisterGuestServiceWorkers,
} from "@/lib/pwa/clear-guest-sw-cache";
import { isGuestQrPath } from "@/lib/pwa/guest-route";
import {
  refreshAppServiceWorker,
} from "@/lib/pwa/register-service-worker";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (isGuestQrPath(window.location.pathname)) {
      void unregisterGuestServiceWorkers().then(() =>
        clearStaleGuestSwCaches({ aggressive: true })
      );
      return;
    }

    void refreshAppServiceWorker();
  }, []);

  return null;
}
