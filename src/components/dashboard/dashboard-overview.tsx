"use client";

import { OverviewDenisStrip } from "@/components/dashboard/overview-denis-strip";
import { OverviewFloorSnapshot } from "@/components/dashboard/overview-floor-snapshot";
import { OverviewKpiStrip } from "@/components/dashboard/overview-kpi-strip";
import { OverviewLiveFeed } from "@/components/dashboard/overview-live-feed";
import { OverviewQuickActions } from "@/components/dashboard/overview-quick-actions";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
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
    tableStatuses,
  } = useDashboardOverview({
    sparkline: initialData.sparkline,
    tableStatuses: initialData.tableStatuses,
  });

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
        <div className="lg:col-span-8">
          <OverviewFloorSnapshot
            tables={tableStatuses}
            loading={overviewLoading}
            currency={currency}
          />
        </div>
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-4 lg:min-h-[280px]">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
              Quick actions
            </p>
            <OverviewQuickActions />
          </div>
        </div>
      </div>

      <OverviewLiveFeed initialOrders={initialData.liveFeed} compact maxOrders={4} />

      <OverviewDenisStrip />
    </div>
  );
}
