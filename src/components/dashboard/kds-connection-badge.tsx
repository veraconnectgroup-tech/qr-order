"use client";

import { cn } from "@/lib/utils";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";

const labels: Record<RealtimeMode, string> = {
  connecting: "Ponovo povezivanje…",
  live: "Povezan",
  polling: "Ponovo povezivanje…",
};

export function KdsConnectionBadge({ mode }: { mode: RealtimeMode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
        mode === "live" &&
          "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
        mode === "polling" &&
          "border-amber-500/40 bg-amber-500/15 text-amber-200",
        mode === "connecting" &&
          "border-zinc-600 bg-zinc-800/80 text-zinc-400"
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          mode === "live" && "animate-pulse bg-emerald-400",
          mode === "polling" && "bg-amber-400",
          mode === "connecting" && "animate-pulse bg-zinc-500"
        )}
      />
      {labels[mode]}
    </span>
  );
}
