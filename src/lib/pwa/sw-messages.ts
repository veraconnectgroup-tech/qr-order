"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { flushOfflineOrderQueue } from "@/lib/pwa/offline-order-queue";

export function usePwaServiceWorkerMessages() {
  const router = useRouter();

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    async function onMessage(event: MessageEvent) {
      const type = (event.data as { type?: string } | null)?.type;
      if (type === "REFRESH_MENU") {
        router.refresh();
      }
      if (type === "FLUSH_ORDER_QUEUE") {
        await flushOfflineOrderQueue();
      }
    }

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);
}

export async function registerMenuPeriodicSync() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    await (
      reg as ServiceWorkerRegistration & {
        periodicSync?: {
          register: (tag: string, options: { minInterval: number }) => Promise<void>;
        };
      }
    ).periodicSync?.register("refresh-menu-cache", {
      minInterval: 4 * 60 * 60 * 1000,
    });
  } catch {
    // Periodic Background Sync unsupported.
  }
}
