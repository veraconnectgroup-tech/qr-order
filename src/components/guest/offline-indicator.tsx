"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useOnlineStatus } from "@/hooks/use-online-status";

export function OfflineIndicator() {
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
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ duration: 0.25 }}
          className={`fixed inset-x-0 top-0 z-[60] border-b py-2 text-center text-sm ${
            showReconnected
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
              : "border-zinc-800 bg-zinc-900 text-zinc-400"
          }`}
        >
          {showReconnected ? (
            "Connected"
          ) : (
            <span>
              Offline. Reconnecting
              <span className="inline-flex w-6 justify-start">
                <span className="animate-pulse">...</span>
              </span>
            </span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
