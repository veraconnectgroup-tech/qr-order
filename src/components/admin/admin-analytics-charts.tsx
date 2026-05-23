"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminAnalyticsSnapshot, PaymentMethodSlice } from "@/lib/analytics/admin-analytics";
import { formatPrice } from "@/lib/format";

const ORANGE = "#f97316";
const CHART_COLORS = ["#f97316", "#3b82f6", "#22c55e", "#a855f7", "#71717a"];

function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-neutral-200 bg-white p-6 shadow-sm ${className ?? ""}`}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: "#ffffff",
  border: "1px solid #e5e5e5",
  borderRadius: "8px",
  fontSize: "12px",
  color: "#171717",
};

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

export function AdminPaymentMethodsChart({
  paymentMethods,
  currency,
}: {
  paymentMethods: AdminAnalyticsSnapshot["paymentMethods"];
  currency: string;
}) {
  return (
    <ChartCard
      title="Payment methods"
      description="Share of paid revenue"
      className="h-full"
    >
      {paymentMethods.length === 0 ? (
        <p className="py-12 text-center text-sm text-neutral-500">
          No paid orders in this period
        </p>
      ) : (
        <div className="grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={paymentMethods}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={88}
                paddingAngle={2}
              >
                {paymentMethods.map((entry, index) => (
                  <Cell
                    key={entry.key}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
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
            {paymentMethods.map((method, index) => (
              <li
                key={method.key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor:
                        CHART_COLORS[index % CHART_COLORS.length],
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

export function AdminAnalyticsCharts({
  data,
  currency,
}: {
  data: AdminAnalyticsSnapshot;
  currency: string;
}) {
  const { revenueSeries, topItems, hourlyOrders } = data;

  return (
    <div className="space-y-6">
      <ChartCard
        title="Revenue"
        description="Paid orders only · EUR"
        className="col-span-full"
      >
        {revenueSeries.every((p) => p.revenue === 0) ? (
          <p className="py-16 text-center text-sm text-neutral-500">
            No paid revenue in this period
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={revenueSeries}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
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
                width={56}
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

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Top 5 items"
          description="By quantity sold"
        >
          {topItems.length === 0 ? (
            <p className="py-12 text-center text-sm text-neutral-500">
              No items sold in this period
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 text-left text-neutral-500">
                    <th className="pb-2 pr-3 font-medium">#</th>
                    <th className="pb-2 pr-3 font-medium">Item</th>
                    <th className="pb-2 pr-3 text-right font-medium">Qty</th>
                    <th className="pb-2 text-right font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topItems.map((item) => (
                    <tr
                      key={`${item.rank}-${item.name}`}
                      className="border-b border-neutral-100 last:border-0"
                    >
                      <td className="py-2.5 pr-3 text-neutral-400">
                        {item.rank}
                      </td>
                      <td className="py-2.5 pr-3 font-medium text-neutral-900">
                        {item.name}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-700">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 text-right tabular-nums text-neutral-900">
                        {formatPrice(item.revenue, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Orders by hour"
          description="Peak service hours (0–23h)"
        >
          {hourlyOrders.every((p) => p.orders === 0) ? (
            <p className="py-12 text-center text-sm text-neutral-500">
              No orders in this period
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={hourlyOrders}>
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
                />
                <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
