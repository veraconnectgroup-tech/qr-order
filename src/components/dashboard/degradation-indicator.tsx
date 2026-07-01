"use client";

import { cn } from "@/lib/utils";
import type { DegradationLevel } from "@/lib/denis/config/degradation-ladder";

const LEVEL_UI: Record<
  DegradationLevel,
  { label: string; className: string; dotClassName: string }
> = {
  full: {
    label: "Denis full",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    dotClassName: "bg-emerald-400",
  },
  reduced: {
    label: "Denis reduced",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-200",
    dotClassName: "bg-amber-400",
  },
  essential: {
    label: "Denis essential",
    className: "border-orange-500/25 bg-orange-500/10 text-orange-200",
    dotClassName: "bg-orange-400",
  },
  fallback: {
    label: "Denis fallback",
    className: "border-red-500/25 bg-red-500/10 text-red-200",
    dotClassName: "bg-red-400",
  },
  offline: {
    label: "Denis offline",
    className: "border-zinc-600/40 bg-zinc-800/80 text-zinc-300",
    dotClassName: "bg-zinc-400",
  },
};

export function DegradationIndicator({
  level,
  staffMessage,
  circuits,
}: {
  level: DegradationLevel;
  staffMessage?: string | null;
  circuits?: {
    openai?: string;
    fiskaly?: string;
    stripe?: string;
  };
}) {
  const ui = LEVEL_UI[level];
  const openCircuits = [
    circuits?.openai === "open" ? "OpenAI" : null,
    circuits?.fiskaly === "open" ? "Fiskaly" : null,
    circuits?.stripe === "open" ? "Stripe" : null,
  ].filter(Boolean);

  const title = [
    staffMessage,
    openCircuits.length ? `Circuits open: ${openCircuits.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      className={cn(
        "inline-flex max-w-[220px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        ui.className
      )}
      title={title || ui.label}
    >
      <span className={cn("size-1.5 rounded-full", ui.dotClassName)} />
      <span className="truncate">{ui.label}</span>
    </span>
  );
}
