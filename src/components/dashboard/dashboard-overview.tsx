"use client";

import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { FloorView } from "@/components/dashboard/floor-view";
import { OverviewDenisStrip } from "@/components/dashboard/overview-denis-strip";
import { OverviewKpiStrip } from "@/components/dashboard/overview-kpi-strip";
import { OverviewLiveFeed } from "@/components/dashboard/overview-live-feed";
import { OverviewQuickActions } from "@/components/dashboard/overview-quick-actions";
import { PeakHoursHeatmap } from "@/components/dashboard/peak-hours-heatmap";
import { RevenueTicker } from "@/components/dashboard/revenue-ticker";
import { StaffPerformancePanel } from "@/components/dashboard/staff-performance-panel";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
import { useDenisActivityFeed } from "@/hooks/use-denis-activity-feed";
import { useFloorStatus } from "@/hooks/use-floor-status";
import { usePeakHours } from "@/hooks/use-peak-hours";
import { useRealtimeOrderTicker } from "@/hooks/use-realtime-orders";
import { useStaffPerformance } from "@/hooks/use-staff-performance";
import type { DashboardOverviewInitialData } from "@/lib/dashboard/overview-types";

export function DashboardOverview({
  initialData,
}: {
  initialData: DashboardOverviewInitialData;
}) {
  const { currency, locationName } = useDashboard();
  const {
    loading: statsLoading,
    todayRevenue,
    todayOrderCount,
    todayAvgTicket,
    yesterdayRevenue,
    yesterdayOrderCount,
    yesterdayAvgTicket,
    activeSessions,
    totalTables,
    pendingWaiterCalls,
  } = useDashboardStats(initialData.stats);
  const {
    loading: overviewLoading,
    sparkline,
  } = useDashboardOverview({
    sparkline: initialData.sparkline,
    tableStatuses: initialData.tableStatuses,
  });
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
  const { loading: staffLoading, rows: staffRows } = useStaffPerformance(
    initialData.staffPerformance
  );
  const { loading: peakLoading, buckets: peakBuckets } = usePeakHours(
    initialData.peakHours
  );

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-dash-text-disabled">
          Operations overview
        </p>
        <h2 className="mt-1 text-xl font-bold text-dash-text sm:text-2xl">
          {locationName}
        </h2>
      </div>

      <RevenueTicker
        currency={currency}
        revenue={ticker.todayRevenue}
        orderCount={ticker.todayOrderCount}
        avgTicket={ticker.todayAvgTicket}
        loading={tickerLoading && statsLoading}
      />

      <OverviewKpiStrip
        currency={currency}
        statsLoading={statsLoading}
        overviewLoading={overviewLoading}
        sparkline={sparkline}
        todayRevenue={todayRevenue}
        todayOrderCount={todayOrderCount}
        todayAvgTicket={todayAvgTicket}
        yesterdayRevenue={yesterdayRevenue}
        yesterdayOrderCount={yesterdayOrderCount}
        yesterdayAvgTicket={yesterdayAvgTicket}
        activeSessions={activeSessions}
        totalTables={totalTables}
        pendingWaiterCalls={pendingWaiterCalls}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <FloorView
            tables={floorTables}
            loading={floorLoading}
            currency={currency}
          />
          <div className="grid gap-4 md:grid-cols-2">
            <StaffPerformancePanel
              rows={staffRows}
              currency={currency}
              loading={staffLoading}
            />
            <PeakHoursHeatmap
              buckets={peakBuckets}
              currency={currency}
              loading={peakLoading}
            />
          </div>
          <OverviewLiveFeed
            initialOrders={initialData.liveFeed}
            compact
            maxOrders={4}
          />
        </div>

        <div className="space-y-4 lg:col-span-4">
          <div className="lg:sticky lg:top-4 lg:space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
                Quick actions
              </p>
              <OverviewQuickActions />
            </div>
            <ActivityFeed items={activityItems} loading={activityLoading} />
          </div>
        </div>
      </div>

      <OverviewDenisStrip />
    </div>
  );
}
