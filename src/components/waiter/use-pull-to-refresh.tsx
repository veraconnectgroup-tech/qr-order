"use client";

import { useCallback, useRef, useState } from "react";
import { hapticLight } from "@/lib/haptics";
import { cn } from "@/lib/utils";

type Options = {
  onRefresh: () => Promise<void> | void;
  disabled?: boolean;
  threshold?: number;
  hint?: string;
  release?: string;
  refreshingLabel?: string;
};

export function usePullToRefresh({
  onRefresh,
  disabled = false,
  threshold = 72,
  hint = "Pull to refresh",
  release = "Release to refresh",
  refreshingLabel = "Refreshing…",
}: Options) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const pullingRef = useRef(false);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (disabled || refreshing) return;
      if (window.scrollY > 0) return;
      startYRef.current = event.touches[0]?.clientY ?? 0;
      pullingRef.current = true;
    },
    [disabled, refreshing]
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!pullingRef.current || disabled || refreshing) return;
      const currentY = event.touches[0]?.clientY ?? 0;
      const delta = Math.max(0, currentY - startYRef.current);
      setPullDistance(Math.min(delta, threshold * 1.5));
    },
    [disabled, refreshing, threshold]
  );

  const onTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;

    if (pullDistance >= threshold && !disabled && !refreshing) {
      setRefreshing(true);
      hapticLight();
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDistance(0);
      }
      return;
    }

    setPullDistance(0);
  }, [disabled, onRefresh, pullDistance, refreshing, threshold]);

  const bind = {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel: onTouchEnd,
  };

  const indicator = (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden text-xs font-medium text-dash-text-muted transition-[height,opacity]",
        pullDistance > 0 || refreshing ? "opacity-100" : "opacity-0"
      )}
      style={{ height: refreshing ? threshold / 2 : pullDistance / 2 }}
      aria-hidden
    >
      {refreshing
        ? refreshingLabel
        : pullDistance >= threshold
          ? release
          : hint}
    </div>
  );

  return { bind, indicator, refreshing, pullDistance };
}
