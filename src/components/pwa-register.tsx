"use client";

import { useEffect } from "react";
import { isGuestQrPath } from "@/lib/pwa/guest-route";
import { registerAppServiceWorker } from "@/lib/pwa/register-service-worker";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (isGuestQrPath(window.location.pathname)) return;

    void registerAppServiceWorker()
      .then((registration) => {
        void registration.update();
      })
      .catch(() => {
        // Missing when PWA plugin is disabled or build used Turbopack without SW output.
      });
  }, []);

  return null;
}
