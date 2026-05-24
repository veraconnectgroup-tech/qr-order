"use client";

import { cn } from "@/lib/utils";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";
import type { ConnectionStatus } from "@/hooks/use-connection-status";

export type KdsConnectionMode = "live" | "polling" | "offline";

type Props = {
  realtimeMode: RealtimeMode;
  connectionStatus?: ConnectionStatus;
  fetchOk?: boolean;
  lastUpdatedAt?: Date | null;
};

function deriveMode({
  realtimeMode,
  connectionStatus = "online",
  fetchOk = true,
}: Props): KdsConnectionMode {
  if (connectionStatus === "offline" || !fetchOk) return "offline";
  if (realtimeMode === "live") return "live";
  return "polling";
}

const labels: Record<KdsConnectionMode, string> = {
  live: "⚡ Live",
  polling: "↻ Polling",
  offline: "✕ Offline",
};

function formatLastUpdate(lastUpdatedAt?: Date | null): string | null {
  if (!lastUpdatedAt) return null;
  const seconds = Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000);
  if (seconds < 60) return `Letztes Update: vor ${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `Letztes Update: vor ${minutes} Min`;
}

export function KdsConnectionBadge({
  realtimeMode,
  connectionStatus,
  fetchOk,
  lastUpdatedAt,
}: Props) {
  const mode = deriveMode({ realtimeMode, connectionStatus, fetchOk });
  const staleHint = mode === "offline" ? formatLastUpdate(lastUpdatedAt) : null;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium",
          mode === "live" &&
            "border-emerald-500/40 bg-emerald-500/15 text-emerald-300",
          mode === "polling" &&
            "border-amber-500/40 bg-amber-500/15 text-amber-200",
          mode === "offline" &&
            "border-red-500/40 bg-red-500/15 text-red-300"
        )}
      >
        <span
          className={cn(
            "size-2 rounded-full",
            mode === "live" && "animate-pulse bg-emerald-400",
            mode === "polling" && "bg-amber-400",
            mode === "offline" && "bg-red-400"
          )}
        />
        {labels[mode]}
      </span>
      {staleHint && (
        <span className="text-xs text-zinc-500">{staleHint}</span>
      )}
    </div>
  );
}

export function kdsSecondsSinceUpdate(lastUpdatedAt: Date | null): number {
  if (!lastUpdatedAt) return Infinity;
  return Math.floor((Date.now() - lastUpdatedAt.getTime()) / 1000);
}
