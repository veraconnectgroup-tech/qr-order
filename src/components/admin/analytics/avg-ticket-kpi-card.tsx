import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { formatPrice } from "@/lib/format";

export function AvgTicketKpiCard({
  currency,
  avgTicket,
  changePct,
}: {
  currency: string;
  avgTicket: number;
  changePct: number;
}) {
  return (
    <AnalyticsMetricCard
      label="Average ticket"
      value={formatPrice(avgTicket, currency)}
      hint="Revenue ÷ orders"
      changePct={changePct}
    />
  );
}
