"use client";

import { ChartCard } from "@/components/admin/analytics/chart-card";
import type { ConversionFunnelSnapshot } from "@/lib/analytics/admin-intelligence/types";
import { cn } from "@/lib/utils";

export function ConversionFunnelChart({
  data,
  className,
}: {
  data: ConversionFunnelSnapshot;
  className?: string;
}) {
  const maxCount = Math.max(1, ...data.steps.map((step) => step.count));

  return (
    <ChartCard
      title="Denis conversion funnel"
      description="Where guests drop off — Scan QR through Pay"
      className={className}
    >
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <p className="text-muted-foreground">
          Cart abandonment:{" "}
          <span className="font-semibold text-foreground">
            {data.cartAbandonmentRate}%
          </span>
        </p>
        {data.biggestDropOffStage ? (
          <p className="text-muted-foreground">
            Biggest drop-off:{" "}
            <span className="font-semibold text-amber-600">
              {data.steps.find((step) => step.stage === data.biggestDropOffStage)
                ?.label ?? data.biggestDropOffStage}
            </span>
          </p>
        ) : null}
      </div>

      <div className="space-y-3">
        {data.steps.map((step) => (
          <div key={step.stage}>
            <div className="mb-1 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">{step.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {step.count.toLocaleString()} · {step.pctOfTotal}%
                {step.dropOffPct != null ? ` · −${step.dropOffPct}%` : ""}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full bg-[var(--qr-ember,#f97316)] transition-all"
                )}
                style={{ width: `${Math.max(4, (step.count / maxCount) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}
