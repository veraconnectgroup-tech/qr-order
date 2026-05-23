"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RevenueSeriesPoint } from "@/lib/analytics/admin-analytics";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartCard, ORANGE, tooltipStyle } from "./chart-card";

function RevenueTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ value?: number }>;
  label?: string;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm"
      style={tooltipStyle}
    >
      <p className="font-medium text-neutral-900">{label}</p>
      <p className="mt-0.5 text-neutral-600">
        {formatPrice(Number(payload[0]?.value ?? 0), currency)}
      </p>
    </div>
  );
}

export function RevenueChart({
  data,
  currency,
  className,
}: {
  data: RevenueSeriesPoint[];
  currency: string;
  className?: string;
}) {
  return (
    <ChartCard
      title="Revenue"
      description="Paid orders only"
      className={cn("h-full", className)}
    >
      {data.every((p) => p.revenue === 0) ? (
        <p className="py-16 text-center text-sm text-neutral-500">
          No paid revenue in this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={ORANGE} stopOpacity={0.4} />
                <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#f5f5f5" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#737373", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#737373", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(v) => formatPrice(v, currency)}
            />
            <Tooltip content={<RevenueTooltip currency={currency} />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={ORANGE}
              strokeWidth={2}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
