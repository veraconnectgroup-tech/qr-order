"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TopItemRow } from "@/lib/analytics/admin-analytics";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ChartCard, ORANGE, tooltipStyle } from "./chart-card";

function TopItemTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: TopItemRow & { shortName: string } }>;
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div
      className="rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm"
      style={tooltipStyle}
    >
      <p className="font-medium text-foreground">
        #{item.rank} {item.name}
      </p>
      <p className="mt-0.5 text-muted-foreground">{item.quantity} sold</p>
      <p className="text-muted-foreground">{formatPrice(item.revenue, currency)}</p>
    </div>
  );
}

export function TopProductsChart({
  data,
  currency,
  className,
}: {
  data: TopItemRow[];
  currency: string;
  className?: string;
}) {
  const chartData = data.map((item) => ({
    ...item,
    shortName:
      item.name.length > 22 ? `${item.name.slice(0, 20)}…` : item.name,
  }));

  return (
    <ChartCard
      title="Top 5 products"
      description="By quantity sold"
      className={cn("h-full", className)}
    >
      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No items sold in this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
          >
            <CartesianGrid stroke="#f5f5f5" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#737373", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="shortName"
              tick={{ fill: "#737373", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={108}
            />
            <Tooltip content={<TopItemTooltip currency={currency} />} />
            <Bar dataKey="quantity" fill={ORANGE} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
