"use client";

import { ChartCard } from "@/components/admin/analytics/chart-card";
import type { DenisPerformanceSnapshot } from "@/lib/analytics/admin-intelligence/types";

export function DenisPerformancePanel({
  data,
  className,
}: {
  data: DenisPerformanceSnapshot;
  className?: string;
}) {
  return (
    <ChartCard
      title="Denis performance"
      description="Upsell success, language coverage, handoffs, response time"
      className={className}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Conversion" value={`${(data.conversionRate * 100).toFixed(1)}%`} />
        <Metric label="Language set" value={`${data.languageAccuracyPct}%`} />
        <Metric label="Handoff rate" value={`${data.handoffRate}%`} />
        <Metric
          label="Avg response"
          value={
            data.avgResponseMs != null
              ? `${(data.avgResponseMs / 1000).toFixed(1)}s`
              : "—"
          }
        />
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Upsell success by nudge type
      </p>
      {data.upsellByNudgeKind.length === 0 ? (
        <p className="text-sm text-muted-foreground">No nudge data in this period.</p>
      ) : (
        <ul className="space-y-2">
          {data.upsellByNudgeKind.slice(0, 8).map((row) => (
            <li
              key={row.kind}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2 text-sm"
            >
              <span className="font-medium capitalize text-foreground">
                {row.kind.replace(/_/g, " ")}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {row.conversions}/{row.impressions} · {row.successRate}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
        {value}
      </p>
    </div>
  );
}
