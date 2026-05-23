import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { formatPrice } from "@/lib/format";

export function RevenueKpiCard({
  currency,
  revenue,
  changePct,
}: {
  currency: string;
  revenue: number;
  changePct: number;
}) {
  return (
    <AnalyticsMetricCard
      label="Total revenue"
      value={formatPrice(revenue, currency)}
      hint="Paid orders only"
      changePct={changePct}
    />
  );
}
