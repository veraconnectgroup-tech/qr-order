"use client";

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { PaymentMethodSlice } from "@/lib/analytics/admin-analytics";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  ChartCard,
  EMERALD_500,
  ORANGE,
  tooltipStyle,
  ZINC_500,
} from "./chart-card";

const PAYMENT_COLORS: Record<string, string> = {
  online: ORANGE,
  at_bar: ZINC_500,
  card_at_table: EMERALD_500,
};

export function PaymentMethodsChart({
  data,
  currency,
  className,
}: {
  data: PaymentMethodSlice[];
  currency: string;
  className?: string;
}) {
  return (
    <ChartCard
      title="Payment methods"
      description="Share of paid revenue"
      className={cn("h-full", className)}
    >
      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          No paid orders in this period
        </p>
      ) : (
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data}
                dataKey="total"
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
                    fill={PAYMENT_COLORS[entry.key] ?? ZINC_500}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, _name, item) => {
                  const amount = Number(value ?? 0);
                  const payload = item.payload as PaymentMethodSlice;
                  return [
                    `${formatPrice(amount, currency)} (${payload.percent.toFixed(1)}%)`,
                    payload.name,
                  ];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <ul className="space-y-3">
            {data.map((method) => (
              <li
                key={method.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        PAYMENT_COLORS[method.key] ?? ZINC_500,
                    }}
                  />
                  <span className="text-neutral-700">{method.name}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium tabular-nums text-neutral-900">
                    {formatPrice(method.total, currency)}
                  </p>
                  <p className="text-xs text-neutral-500">
                    {method.percent.toFixed(1)}%
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
