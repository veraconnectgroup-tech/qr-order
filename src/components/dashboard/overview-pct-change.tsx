"use client";

import { pctChange } from "@/lib/dashboard/overview-stats";
import { cn } from "@/lib/utils";

export function OverviewPctChange({
  current,
  previous,
}: {
  current: number;
  previous: number;
}) {
  const diff = pctChange(current, previous);

  if (diff === 0 && previous === 0 && current === 0) {
    return <p className="mt-1 text-xs text-dash-text-disabled">vs yesterday —</p>;
  }

  const positive = diff >= 0;
  return (
    <p
      className={cn(
        "mt-1 text-xs",
        positive ? "text-emerald-400" : "text-red-400"
      )}
    >
      {positive ? "+" : ""}
      {diff.toFixed(0)}% vs yesterday
    </p>
  );
}
