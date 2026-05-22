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
import {
  computeDailyRevenue,
  computeHourlyOrders,
  computeTopItems,
} from "@/lib/analytics/order-analytics";
import { formatPrice } from "@/lib/format";
import type { OrderWithDetails } from "@/types";

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-medium text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: "8px",
  fontSize: "12px",
};

export function AnalyticsCharts({
  orders,
  range,
  currency,
}: {
  orders: OrderWithDetails[];
  range: { start: Date; end: Date };
  currency: string;
}) {
  const daily = computeDailyRevenue(orders, range);
  const topItems = computeTopItems(orders, 5);
  const hourly = computeHourlyOrders(orders);

  const dailyLabels = daily.map((d) => {
    const date = new Date(`${d.date}T12:00:00`);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    });
  });

  const dailyChart = daily.map((d, i) => ({
    label: dailyLabels[i],
    revenue: d.revenue,
    orders: d.orders,
  }));

  if (!orders.length) {
    return (
      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 py-12 text-center text-zinc-500">
        No data for charts in this period
      </div>
    );
  }

  return (
    <div className="mb-6 grid gap-4 sm:mb-8 lg:grid-cols-2">
      <ChartCard title="Revenue by day">
        <div className="h-44 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyChart}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v) => formatPrice(v, currency)}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#fafafa" }}
                formatter={(value) =>
                  formatPrice(Number(value ?? 0), currency)
                }
              />
              <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Top items">
        <div className="h-44 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topItems} layout="vertical" margin={{ left: 8 }}>
              <CartesianGrid stroke="#27272a" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={100}
                tick={{ fill: "#a1a1aa", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#fafafa" }}
              />
              <Bar dataKey="count" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Orders by hour">
        <div className="h-44 lg:col-span-2 sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hourly}>
              <CartesianGrid stroke="#27272a" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#71717a", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={{ color: "#fafafa" }}
              />
              <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  );
}
