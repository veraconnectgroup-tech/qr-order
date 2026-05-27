"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { OverviewSparklinePoint } from "@/lib/dashboard/overview-types";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function OverviewSparkline({
  data,
  currency,
  loading,
  inline = false,
}: {
  data: OverviewSparklinePoint[];
  currency: string;
  loading?: boolean;
  inline?: boolean;
}) {
  const chartHeight = inline ? 40 : 200;

  if (loading) {
    return (
      <Skeleton
        className={cn(
          "w-full rounded-lg bg-dash-surface-raised",
          inline ? "h-10" : "h-[200px]"
        )}
      />
    );
  }

  const hasData = data.some((d) => d.revenue > 0);

  if (!hasData) {
    return (
      <p
        className={cn(
          "flex items-center justify-center text-dash-text-disabled",
          inline ? "h-10 text-[10px]" : "h-[200px] text-sm"
        )}
      >
        No revenue in the last 7 days
      </p>
    );
  }

  return (
    <div
      className="w-full"
      style={{ height: chartHeight, maxHeight: chartHeight }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: inline ? 0 : 8, right: 0, left: 0, bottom: 0 }}
        >
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as OverviewSparklinePoint;
              return (
                <div className="rounded-lg border border-dash-surface-overlay bg-dash-surface px-2.5 py-1.5 text-xs shadow-lg">
                  <p className="text-dash-text-muted">{row.label}</p>
                  <p className="font-mono font-semibold text-[var(--qr-ember)]">
                    {formatPrice(row.revenue, currency)}
                  </p>
                </div>
              );
            }}
          />
          <Bar
            dataKey="revenue"
            radius={[inline ? 2 : 4, inline ? 2 : 4, 0, 0]}
            maxBarSize={inline ? 12 : 32}
          >
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={
                  entry.isToday
                    ? "var(--qr-ember)"
                    : "var(--dash-surface-overlay)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
