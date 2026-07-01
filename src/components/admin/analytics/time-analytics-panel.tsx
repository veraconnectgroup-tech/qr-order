"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartCard,
  ORANGE,
  tooltipStyle,
} from "@/components/admin/analytics/chart-card";
import type { TimeAnalyticsSnapshot } from "@/lib/analytics/admin-intelligence/types";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

type Granularity = "hour" | "day" | "week" | "month";

export function TimeAnalyticsPanel({
  data,
  currency,
  className,
}: {
  data: TimeAnalyticsSnapshot;
  currency: string;
  className?: string;
}) {
  const [granularity, setGranularity] = useState<Granularity>("hour");

  const series =
    granularity === "hour"
      ? data.byHour
      : granularity === "day"
        ? data.byDay
        : granularity === "week"
          ? data.byWeek
          : data.byMonth;

  return (
    <ChartCard
      title="Time-based analytics"
      description="Revenue and order volume by hour, day, week, and month"
      className={className}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["hour", "Hour"],
            ["day", "Day"],
            ["week", "Week"],
            ["month", "Month"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setGranularity(key)}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs font-medium transition",
              granularity === key
                ? "border-[var(--qr-ember,#f97316)] bg-[var(--qr-ember,#f97316)]/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/50"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" opacity={0.2} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value, name) => {
                if (name === "revenue") {
                  return [formatPrice(Number(value), currency), "Revenue"];
                }
                return [value, "Orders"];
              }}
            />
            <Bar dataKey="orders" fill={ORANGE} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Busiest hours
          </p>
          <ul className="space-y-1 text-sm">
            {data.busiestHours.map((row) => (
              <li key={row.hour} className="flex justify-between gap-2">
                <span>{row.hour}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.orders} orders · {formatPrice(row.revenue, currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Slowest hours
          </p>
          <ul className="space-y-1 text-sm">
            {data.slowestHours.map((row) => (
              <li key={row.hour} className="flex justify-between gap-2">
                <span>{row.hour}</span>
                <span className="tabular-nums text-muted-foreground">
                  {row.orders} orders
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data.staffSuggestions.length > 0 ? (
        <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Staff scheduling suggestions
          </p>
          <ul className="space-y-2 text-sm">
            {data.staffSuggestions.map((row) => (
              <li key={`${row.dayLabel}-${row.hourRange}`} className="text-foreground">
                {row.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ChartCard>
  );
}
