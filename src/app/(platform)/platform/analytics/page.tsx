import { RevenueChart, PlatformBarChart } from "@/components/charts-dynamic";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { loadPlatformAnalytics } from "@/lib/platform/platform-stats";
import { formatPrice } from "@/lib/format";

export default async function PlatformAnalyticsPage() {
  const data = await loadPlatformAnalytics();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last 30 days across all venues.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsMetricCard
          label="Total revenue"
          value={formatPrice(data.totalRevenue, "EUR")}
        />
        <AnalyticsMetricCard label="Total orders" value={String(data.totalOrders)} />
        <AnalyticsMetricCard label="Active orgs" value={String(data.activeOrgs)} />
        <AnalyticsMetricCard label="Churned (30d)" value={String(data.churned)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <RevenueChart data={data.revenueSeries} currency="EUR" />
        <PlatformBarChart
          title="Orders per day"
          description="Paid orders"
          data={data.ordersSeries}
        />
      </div>
    </div>
  );
}
