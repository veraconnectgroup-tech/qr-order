"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { OrderSourceSlice } from "@/lib/analytics/admin-analytics";
import { cn } from "@/lib/utils";
import { ChartCard, BLUE_500, ORANGE, tooltipStyle, ZINC_500 } from "./chart-card";

const ORDER_SOURCE_COLORS: Record<OrderSourceSlice["key"], string> = {
  qr: ORANGE,
  staff: BLUE_500,
  kiosk: ZINC_500,
  pos: "#9333ea",
};

export function OrderSourceChart({
  data,
  className,
}: {
  data: OrderSourceSlice[];
  className?: string;
}) {
  const total = data.reduce((sum, slice) => sum + slice.count, 0);

  return (
    <ChartCard
      title="Order source"
      description="QR vs staff vs kiosk"
      className={cn("h-full", className)}
    >
      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          No orders in this period
        </p>
      ) : (
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={88}
                paddingAngle={2}
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={ORDER_SOURCE_COLORS[entry.key]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _name, item) => {
                  const count = Number(value ?? 0);
                  const payload = item.payload as OrderSourceSlice;
                  return [
                    `${count} orders (${payload.percent.toFixed(1)}%)`,
                    payload.name,
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-3">
            {data.map((source) => (
              <li
                key={source.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: ORDER_SOURCE_COLORS[source.key] }}
                  />
                  <span className="text-neutral-700">{source.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums text-neutral-900">
                    {source.count}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {source.percent.toFixed(1)}%
                  </p>
                </div>
              </li>
            ))}
            <li className="border-t border-neutral-100 pt-2 text-xs text-neutral-500">
              {total} orders total
            </li>
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
