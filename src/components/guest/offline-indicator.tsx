"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAppLocale } from "@/components/guest/app-locale-provider";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineIndicator() {
  const { tUI } = useAppLocale();
  const reduceMotion = useReducedMotion();
  const isOnline = useOnlineStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
      setShowReconnected(false);
      return;
    }
    if (wasOffline && isOnline) {
      setShowReconnected(true);
      const t = setTimeout(() => setShowReconnected(false), 2000);
      return () => clearTimeout(t);
    }
  }, [isOnline, wasOffline]);

  const visible = !isOnline || showReconnected;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={reduceMotion ? false : { y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? undefined : { y: -48, opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.25 }}
          className={`fixed inset-x-0 top-0 z-[60] border-b py-2 text-center text-sm ${
            showReconnected
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-zinc-800 bg-zinc-900 text-zinc-400"
          }`}
        >
          {showReconnected ? (
            tUI("offline.connected")
          ) : (
            <span>{tUI("offline.banner")}</span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
