"use client";

import { cn } from "@/lib/utils";

export function KitchenCapacityBar({
  message,
  level,
}: {
  message: string;
  level: "yellow" | "red";
}) {
  return (
    <div
      className={cn(
        "mx-4 mb-2 rounded-xl border px-4 py-2.5 text-sm leading-snug",
        level === "red"
          ? "border-orange-500/35 bg-orange-500/10 text-orange-100"
          : "border-amber-500/30 bg-amber-500/10 text-amber-100"
      )}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
