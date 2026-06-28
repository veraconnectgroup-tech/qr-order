import type { AdminIntelligenceSnapshot } from "@/lib/analytics/admin-intelligence/types";
import { CompetitorBenchmarkCard } from "@/components/admin/analytics/competitor-benchmark-card";
import { ConversionFunnelChart } from "@/components/admin/analytics/conversion-funnel-chart";
import { DenisPerformancePanel } from "@/components/admin/analytics/denis-performance-panel";
import { ActionableInsightsWidget } from "@/components/admin/analytics/actionable-insights-widget";
import { MenuPerformanceMatrix } from "@/components/admin/analytics/menu-performance-matrix";
import { TimeAnalyticsPanel } from "@/components/admin/analytics/time-analytics-panel";

export function AdminIntelligenceDashboard({
  snapshot,
  currency,
  actionableInsights,
  dailyBriefingLine,
}: {
  snapshot: AdminIntelligenceSnapshot;
  currency: string;
  actionableInsights?: import("@/lib/dashboard/generate-actionable-insights").ActionableInsight[];
  dailyBriefingLine?: string | null;
}) {
  return (
    <div className="mt-6 space-y-4">
      {(actionableInsights?.length ?? 0) > 0 || dailyBriefingLine ? (
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground">
            Denis actionable insights
          </h3>
          <div className="mt-3">
            <ActionableInsightsWidget
              insights={actionableInsights ?? []}
              dailyBriefingLine={dailyBriefingLine}
            />
          </div>
        </section>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <ConversionFunnelChart
          data={snapshot.funnel}
          className="lg:col-span-7"
        />
        <CompetitorBenchmarkCard
          data={snapshot.competitorBenchmark}
          currency={currency}
          className="lg:col-span-5"
        />
      </div>

      <MenuPerformanceMatrix
        data={snapshot.menuMatrix}
        currency={currency}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <TimeAnalyticsPanel
          data={snapshot.timeAnalytics}
          currency={currency}
          className="lg:col-span-7"
        />
        <DenisPerformancePanel
          data={snapshot.denisPerformance}
          className="lg:col-span-5"
        />
      </div>
    </div>
  );
}
