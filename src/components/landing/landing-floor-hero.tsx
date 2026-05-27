"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { FloorTile } from "@/components/design-system";
import { cn } from "@/lib/utils";

const TILE_COUNT = 16;
const OCCUPIED_COUNT = 6;

const TABLE_LABELS = Array.from({ length: TILE_COUNT }, (_, index) => `T${index + 1}`);

function occupiedIndices(tick: number) {
  const indices = new Set<number>();
  for (let i = 0; i < OCCUPIED_COUNT; i += 1) {
    indices.add((tick + i * 2) % TILE_COUNT);
  }
  return indices;
}

export function LandingFloorHero({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = window.setInterval(() => {
      setTick((value) => value + 1);
    }, 3000);
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const occupied = useMemo(
    () => occupiedIndices(reduceMotion ? 0 : tick),
    [reduceMotion, tick]
  );

  return (
    <div
      className={cn(
        "dashboard-theme h-full rounded-2xl border border-[#1e1e2e] bg-[var(--qr-void)] p-4 sm:p-5",
        className
      )}
    >
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--qr-muted)]">
        Live floor
      </p>
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {TABLE_LABELS.map((label, index) => {
          const status = occupied.has(index) ? "occupied" : "available";
          return (
            <FloorTile
              key={label}
              as="div"
              variant="floor"
              status={status}
              label={label}
              className={cn(
                "p-2 text-center sm:p-3",
                status === "occupied" && !reduceMotion && "animate-pulse"
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
