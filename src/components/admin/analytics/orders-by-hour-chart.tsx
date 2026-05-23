"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HourlyOrdersPoint } from "@/lib/analytics/admin-analytics";
import { cn } from "@/lib/utils";
import { ChartCard, ORANGE, tooltipStyle, ZINC_700 } from "./chart-card";

export function OrdersByHourChart({
  data,
  className,
}: {
  data: HourlyOrdersPoint[];
  className?: string;
}) {
  const [activeHour, setActiveHour] = useState<number | null>(null);

  return (
    <ChartCard
      title="Orders by hour"
      description="Peak service hours (0–23h)"
      className={cn("h-full", className)}
    >
      {data.every((p) => p.orders === 0) ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          No orders in this period
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid stroke="#f5f5f5" vertical={false} />
            <XAxis
              dataKey="hour"
              tick={{ fill: "#737373", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              tick={{ fill: "#737373", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={32}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "#171717" }}
              formatter={(value) => [`${value} orders`, "Count"]}
            />
            <Bar
              dataKey="orders"
              radius={[4, 4, 0, 0]}
              onMouseLeave={() => setActiveHour(null)}
            >
              {data.map((_, index) => (
                <Cell
                  key={index}
                  fill={activeHour === index ? ORANGE : ZINC_700}
                  onMouseEnter={() => setActiveHour(index)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
