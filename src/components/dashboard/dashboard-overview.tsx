"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FloorView } from "@/components/dashboard/floor-view";
import { OverviewAlertRail } from "@/components/dashboard/overview-alert-rail";
import { OverviewDenisStrip } from "@/components/dashboard/overview-denis-strip";
import { OverviewHero } from "@/components/dashboard/overview-hero";
import { OverviewPanel } from "@/components/dashboard/overview-panel";
import { PeakHoursChart } from "@/components/dashboard/peak-hours-chart";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useDenisActivityFeed } from "@/hooks/use-denis-activity-feed";
import { useFloorStatus } from "@/hooks/use-floor-status";
import { usePeakHours } from "@/hooks/use-peak-hours";
import { useRealtimeOrderTicker } from "@/hooks/use-realtime-orders";
import type { DashboardOverviewInitialData } from "@/lib/dashboard/overview-types";

export function DashboardOverview({
  initialData,
}: {
  initialData: DashboardOverviewInitialData;
}) {
  const { currency, locationName } = useDashboard();
  const {
    loading: statsLoading,
    yesterdayRevenue,
    yesterdayOrderCount,
    yesterdayAvgTicket,
    activeSessions,
    totalTables,
  } = useDashboardStats(initialData.stats);
  const { loading: tickerLoading, ...ticker } = useRealtimeOrderTicker({
    todayRevenue: initialData.stats.todayRevenue,
    todayOrderCount: initialData.stats.todayOrderCount,
    todayAvgTicket: initialData.stats.todayAvgTicket,
  });
  const { loading: floorLoading, tables: floorTables } = useFloorStatus(
    initialData.floorTables
  );
  const { loading: activityLoading, items: activityItems } = useDenisActivityFeed(
    initialData.denisActivity
  );
  const { loading: peakLoading, buckets: peakBuckets } = usePeakHours(
    initialData.peakHours
  );

  return (
    <div className="overview-v3 overview-v3-workspace -m-4 flex flex-col md:-m-6">
      <OverviewHero
        locationName={locationName}
        currency={currency}
        loading={tickerLoading && statsLoading}
        revenue={ticker.todayRevenue}
        orderCount={ticker.todayOrderCount}
        avgTicket={ticker.todayAvgTicket}
        yesterdayRevenue={yesterdayRevenue}
        yesterdayOrderCount={yesterdayOrderCount}
        yesterdayAvgTicket={yesterdayAvgTicket}
        activeSessions={activeSessions}
        totalTables={totalTables}
      />

      <OverviewAlertRail />

      <div className="overview-v3-split h-[70dvh] lg:h-[62dvh]">
        <div className="overview-v3-split-floor">
          <OverviewPanel
            title="Live floor"
            actionHref="/dashboard/tables"
            actionLabel="Full floor →"
            flat
            fill
          >
            <FloorView
              tables={floorTables}
              loading={floorLoading}
              currency={currency}
            />
          </OverviewPanel>
        </div>

        <div className="overview-v3-split-activity">
          <OverviewPanel
            title="Denis activity"
            actionHref="/dashboard/denis"
            actionLabel="Full log →"
            flat
            fill
          >
            <ActivityFeed items={activityItems} loading={activityLoading} />
          </OverviewPanel>
        </div>

        <div className="overview-v3-split-peak">
          <OverviewPanel title="Peak hours today" flat fill>
            <PeakHoursChart
              buckets={peakBuckets}
              currency={currency}
              loading={peakLoading}
            />
          </OverviewPanel>
        </div>
      </div>

      <OverviewDenisStrip />
    </div>
  );
}
