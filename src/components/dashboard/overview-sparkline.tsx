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

export function OverviewSparkline({
  data,
  currency,
  loading,
}: {
  data: OverviewSparklinePoint[];
  currency: string;
  loading?: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-[200px] w-full rounded-lg bg-dash-surface-raised" />;
  }

  const hasData = data.some((d) => d.revenue > 0);

  if (!hasData) {
    return (
      <p className="flex h-[200px] items-center justify-center text-sm text-dash-text-disabled">
        No revenue in the last 7 days
      </p>
    );
  }

  return (
    <div className="h-[200px] max-h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0]?.payload as OverviewSparklinePoint;
              return (
                <div className="rounded-lg border border-dash-surface-overlay bg-dash-surface px-2.5 py-1.5 text-xs shadow-lg">
                  <p className="text-dash-text-muted">{row.label}</p>
                  <p className="font-mono font-semibold text-dash-accent">
                    {formatPrice(row.revenue, currency)}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="revenue" radius={[4, 4, 0, 0]} maxBarSize={32}>
            {data.map((entry) => (
              <Cell
                key={entry.date}
                fill={entry.isToday ? "#f97316" : "#3f3f46"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
