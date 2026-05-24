"use client";

import { useEffect } from "react";
import { registerAppServiceWorker } from "@/lib/pwa/register-service-worker";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    void registerAppServiceWorker().catch(() => {
      // Missing when PWA plugin is disabled or build used Turbopack without SW output.
    });
  }, []);

  return null;
}
