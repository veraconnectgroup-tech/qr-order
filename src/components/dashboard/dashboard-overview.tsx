"use client";

import {
  Bell,
  LayoutGrid,
  Receipt,
  TrendingUp,
  Users,
} from "lucide-react";
import { OverviewActiveSessions } from "@/components/dashboard/overview-active-sessions";
import { OverviewKpiCard } from "@/components/dashboard/overview-kpi-card";
import { OverviewLiveFeed } from "@/components/dashboard/overview-live-feed";
import { OverviewPctChange } from "@/components/dashboard/overview-pct-change";
import { OverviewQuickActions } from "@/components/dashboard/overview-quick-actions";
import { OverviewSparkline } from "@/components/dashboard/overview-sparkline";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useDashboardOverview } from "@/hooks/use-dashboard-overview";
import type { DashboardOverviewInitialData } from "@/lib/dashboard/overview-types";
import { formatPrice } from "@/lib/format";

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
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
          Operations overview
        </p>
        <h2 className="mt-1 text-xl font-bold text-zinc-50 sm:text-2xl">
          {locationName}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5 lg:gap-4">
        <OverviewKpiCard
          label="Revenue today"
          value={formatPrice(todayRevenue, currency)}
          icon={TrendingUp}
          loading={statsLoading}
          compare={
            <OverviewPctChange
              current={todayRevenue}
              previous={yesterdayRevenue}
            />
          }
        />
        <OverviewKpiCard
          label="Orders today"
          value={String(todayOrderCount)}
          icon={Receipt}
          loading={statsLoading}
          compare={
            <OverviewPctChange
              current={todayOrderCount}
              previous={yesterdayOrderCount}
            />
          }
        />
        <OverviewKpiCard
          label="Avg ticket"
          value={formatPrice(todayAvgTicket, currency)}
          icon={LayoutGrid}
          loading={statsLoading}
          compare={
            <OverviewPctChange
              current={todayAvgTicket}
              previous={yesterdayAvgTicket}
            />
          }
        />
        <OverviewKpiCard
          label="Open tables"
          value={`${activeSessions} / ${totalTables}`}
          icon={Users}
          loading={statsLoading}
        />
        <OverviewKpiCard
          label="Waiter calls"
          value={String(pendingWaiterCalls)}
          icon={Bell}
          loading={statsLoading}
          highlight={pendingWaiterCalls > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <OverviewLiveFeed initialOrders={initialData.liveFeed} />
        <OverviewQuickActions />

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">
            Revenue · last 7 days
          </h3>
          <OverviewSparkline
            data={sparkline}
            currency={currency}
            loading={overviewLoading}
          />
        </div>

        <OverviewActiveSessions
          tables={tableStatuses}
          loading={overviewLoading}
        />
      </div>
    </div>
  );
}
