"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import {
  useConnectionStatus,
  type ConnectionStatus,
} from "@/hooks/use-connection-status";
import { flushOfflineOrderQueue } from "@/lib/pwa/offline-order-queue";

export function OfflineIndicator({
  showingCachedMenu = false,
}: {
  showingCachedMenu?: boolean;
}) {
  const { tUI } = useAppLocale();
  const reduceMotion = useReducedMotion();
  const { status } = useConnectionStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const previousStatus = useRef<ConnectionStatus>(status);

  useEffect(() => {
    const wasOffline =
      previousStatus.current === "offline" ||
      previousStatus.current === "degraded";
    previousStatus.current = status;

    if (status === "offline" || status === "degraded") {
      setShowReconnected(false);
      return;
    }

    if (wasOffline && status === "online") {
      setShowReconnected(true);
      void flushOfflineOrderQueue().then((result) => {
        if (result.sent > 0) {
          toast.success(
            tUI("offline.ordersSynced", { count: String(result.sent) })
          );
        }
      });
      const timeoutId = window.setTimeout(() => setShowReconnected(false), 2500);
      return () => window.clearTimeout(timeoutId);
    }
  }, [status, tUI]);

  const offlineVisible = status === "offline" || status === "degraded";
  const visible = offlineVisible || showReconnected;

  const offlineMessage = showingCachedMenu
    ? tUI("offline.bannerCached")
    : status === "degraded"
      ? tUI("offline.reconnecting")
      : tUI("offline.banner");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={reduceMotion ? false : { y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? undefined : { y: -48, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          className={`fixed inset-x-0 top-0 z-[60] border-b py-2 text-center text-sm ${
            showReconnected
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/15 text-amber-100"
          }`}
        >
          {showReconnected ? tUI("offline.connected") : offlineMessage}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
