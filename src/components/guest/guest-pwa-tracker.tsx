"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { recordGuestPageView } from "@/lib/pwa/install-timing";
import {
  flushOfflineOrderQueue,
  registerOrderSync,
} from "@/lib/pwa/offline-order-queue";
import { usePwaServiceWorkerMessages } from "@/lib/pwa/sw-messages";

export function GuestPwaTracker() {
  const pathname = usePathname();
  usePwaServiceWorkerMessages();

  useEffect(() => {
    recordGuestPageView();
  }, [pathname]);

  useEffect(() => {
    async function onOnline() {
      await flushOfflineOrderQueue();
    }

    window.addEventListener("online", onOnline);
    void flushOfflineOrderQueue();
    void registerOrderSync();

    return () => window.removeEventListener("online", onOnline);
  }, []);

  return null;
}
