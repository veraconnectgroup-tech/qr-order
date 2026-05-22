"use client";

import { cn } from "@/lib/utils";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";

const labels: Record<RealtimeMode, string> = {
  connecting: "Povezivanje…",
  live: "Uživo",
  polling: "Osvežavanje",
};

export function LiveConnectionBadge({ mode }: { mode: RealtimeMode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        mode === "live" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
        mode === "polling" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-200",
        mode === "connecting" &&
          "border-zinc-700 bg-zinc-800/80 text-zinc-400"
      )}
      title={
        mode === "live"
          ? "Nove porudžbine stižu odmah (Supabase Realtime)"
          : mode === "polling"
            ? "Realtime nije aktivan — osvežavanje na nekoliko sekundi"
            : "Uspostavlja se Realtime veza…"
      }
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          mode === "live" && "bg-emerald-400 animate-pulse",
          mode === "polling" && "bg-amber-400",
          mode === "connecting" && "bg-zinc-500 animate-pulse"
        )}
      />
      {labels[mode]}
    </span>
  );
}
