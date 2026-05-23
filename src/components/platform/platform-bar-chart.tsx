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
import { ChartCard, tooltipStyle } from "@/components/admin/analytics/chart-card";
import type { RevenueSeriesPoint } from "@/lib/analytics/admin-analytics";

export function PlatformBarChart({
  title,
  description,
  data,
  color = "#8b5cf6",
}: {
  title: string;
  description?: string;
  data: RevenueSeriesPoint[];
  color?: string;
}) {
  return (
    <ChartCard title={title} description={description}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
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
            allowDecimals={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="revenue" fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
