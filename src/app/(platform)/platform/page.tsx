import { PlatformBarChart } from "@/components/platform/platform-bar-chart";
import { AnalyticsMetricCard } from "@/components/admin/analytics-metric-card";
import { loadPlatformOverview } from "@/lib/platform/platform-stats";
import { formatPrice } from "@/lib/format";

export default async function PlatformOverviewPage() {
  const data = await loadPlatformOverview();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Platform overview</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cross-tenant metrics for all organizations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnalyticsMetricCard label="Total orgs" value={String(data.totalOrgs)} />
        <AnalyticsMetricCard label="Active orgs" value={String(data.activeOrgs)} />
        <AnalyticsMetricCard label="On trial" value={String(data.trialOrgs)} />
        <AnalyticsMetricCard
          label="Revenue (30d)"
          value={formatPrice(data.revenue30, "EUR")}
        />
      </div>

      <PlatformBarChart
        title="Signups"
        description="New organizations per day"
        data={data.signupsSeries}
      />
    </div>
  );
}
