import { PlatformAnalyticsPanel } from "@/components/platform/platform-analytics-panel";
import { loadPlatformAnalytics } from "@/lib/platform/platform-stats";

export default async function PlatformAnalyticsPage() {
  const data = await loadPlatformAnalytics();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Platform analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          GMV, Denis usage, and growth across all Vera Group venues.
        </p>
      </div>

      <PlatformAnalyticsPanel data={data} />
    </div>
  );
}
