"use client";

import type { ActionableInsight } from "@/lib/dashboard/generate-actionable-insights";
import { formatActionableInsightLine } from "@/lib/dashboard/generate-actionable-insights";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<
  ActionableInsight["type"],
  { border: string; badge: string }
> = {
  opportunity: {
    border: "border-orange-500/30",
    badge: "bg-orange-500/15 text-orange-300",
  },
  problem: {
    border: "border-red-500/30",
    badge: "bg-red-500/15 text-red-300",
  },
  achievement: {
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/15 text-emerald-300",
  },
  experiment_result: {
    border: "border-violet-500/30",
    badge: "bg-violet-500/15 text-violet-300",
  },
};

export function ActionableInsightsWidget({
  insights,
  dailyBriefingLine,
  loading,
}: {
  insights: ActionableInsight[];
  dailyBriefingLine?: string | null;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-dash-surface-raised" />
        <div className="h-16 animate-pulse rounded-xl bg-dash-surface-raised" />
      </div>
    );
  }

  if (insights.length === 0 && !dailyBriefingLine) {
    return (
      <p className="text-sm text-dash-text-disabled">
        Nema actionable insights za ovaj period.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {dailyBriefingLine && (
        <p className="text-sm font-medium text-dash-text-primary">
          {dailyBriefingLine}
        </p>
      )}

      <ul className="space-y-2">
        {insights.slice(0, 3).map((insight) => {
          const styles = TYPE_STYLES[insight.type];
          return (
            <li
              key={insight.id}
              className={cn(
                "rounded-xl border bg-dash-surface-raised/60 px-3 py-2.5",
                styles.border
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    styles.badge
                  )}
                >
                  {insight.type.replace("_", " ")}
                </span>
                {insight.impact === "high" && (
                  <span className="text-[10px] font-semibold uppercase text-dash-text-disabled">
                    high impact
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm font-medium text-dash-text-primary">
                {insight.title}
              </p>
              <p className="mt-0.5 text-xs text-dash-text-muted">
                {formatActionableInsightLine(insight)}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
