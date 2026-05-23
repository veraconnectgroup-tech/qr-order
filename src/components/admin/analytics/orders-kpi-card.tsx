import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";

export function OrdersKpiCard({
  ordersCount,
  changePct,
}: {
  ordersCount: number;
  changePct: number;
}) {
  return (
    <AnalyticsMetricCard
      label="Orders"
      value={String(ordersCount)}
      hint="Excludes cancelled & rejected"
      changePct={changePct}
    />
  );
}
