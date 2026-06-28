import { PlatformBarChart } from "@/components/platform/platform-bar-chart";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { RevenueChart } from "@/components/charts-dynamic";
import { formatMrr } from "@/lib/billing/invoicing";
import { formatPrice } from "@/lib/format";
import type { loadPlatformAnalytics } from "@/lib/platform/platform-stats";

export function PlatformAnalyticsPanel({
  data,
}: {
  data: Awaited<ReturnType<typeof loadPlatformAnalytics>>;
}) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsMetricCard
          label="Total GMV (30d)"
          value={formatPrice(data.totalGmv, "EUR")}
        />
        <AnalyticsMetricCard label="Total orders" value={String(data.totalOrders)} />
        <AnalyticsMetricCard
          label="Denis interactions"
          value={String(data.denisInteractions)}
        />
        <AnalyticsMetricCard
          label="Denis upsell revenue"
          value={formatPrice(data.upsellRevenue, "EUR")}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsMetricCard
          label="Avg session quality"
          value={
            data.avgSessionQuality != null ? `${data.avgSessionQuality}/100` : "—"
          }
        />
        <AnalyticsMetricCard label="Active orgs" value={String(data.activeOrgs)} />
        <AnalyticsMetricCard label="New orgs (30d)" value={String(data.newOrgs30)} />
        <AnalyticsMetricCard
          label="MRR"
          value={formatMrr(data.mrrCents)}
        />
        <AnalyticsMetricCard
          label="Churned (30d)"
          value={String(data.churned)}
          tone={data.churned > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart data={data.revenueSeries} currency="EUR" />
        <PlatformBarChart
          title="Orders per day"
          description="Paid orders across all venues"
          data={data.ordersSeries}
        />
      </div>

      <PlatformBarChart
        title="New organizations"
        description="Signups per day"
        data={data.newOrgsSeries}
        color="#10b981"
      />
    </div>
  );
}
