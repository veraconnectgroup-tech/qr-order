"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useAppLocale } from "@/components/guest/app-locale-provider";

const THRESHOLD = 80;

export function PullToRefresh({
  onRefresh,
  orgInitial,
  children,
}: {
  onRefresh: () => Promise<void>;
  orgInitial: string;
  children: ReactNode;
}) {
  const { tUI } = useAppLocale();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }

  return (
    <div
      className="relative"
      onTouchStart={(e) => {
        if (window.scrollY > 0 || refreshing) return;
        startY.current = e.touches[0].clientY;
        pulling.current = true;
      }}
      onTouchMove={(e) => {
        if (!pulling.current || refreshing) return;
        const delta = e.touches[0].clientY - startY.current;
        if (delta > 0) setPull(Math.min(delta * 0.5, 120));
      }}
      onTouchEnd={async () => {
        if (!pulling.current) return;
        pulling.current = false;
        if (pull >= THRESHOLD) await handleRefresh();
        else setPull(0);
      }}
    >
      <motion.div
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex flex-col items-center justify-end overflow-hidden"
        animate={{ height: refreshing ? 56 : pull > 0 ? pull : 0 }}
      >
        <div className="flex items-center gap-2 pb-2 text-xs text-zinc-500">
          <div
            className={`flex size-8 items-center justify-center rounded-full bg-orange-500/10 text-sm font-bold text-orange-500 ${
              refreshing ? "animate-spin" : ""
            }`}
          >
            {orgInitial}
          </div>
          {refreshing
            ? tUI("refresh.loading")
            : pull >= THRESHOLD
              ? tUI("refresh.release")
              : tUI("refresh.pull")}
        </div>
      </motion.div>
      {children}
    </div>
  );
}
