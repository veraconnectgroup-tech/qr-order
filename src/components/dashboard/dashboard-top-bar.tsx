"use client";

import { useMemo } from "react";
import { TrendingUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { getDashboardPageMeta } from "@/lib/dashboard/page-meta";
import { formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import type { OverviewStatsSnapshot } from "@/lib/dashboard/overview-types";
import { DashboardMobileMenu } from "@/components/dashboard/dashboard-mobile-menu";
import { SoundToggle } from "@/components/dashboard/sound-toggle";
import { PushOptIn } from "@/components/dashboard/push-opt-in";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

export function DashboardTopBar() {
  const pathname = usePathname();
  const { title } = getDashboardPageMeta(pathname);
  const { currency, todayRevenue: contextRevenue } = useDashboard();
  const statsInitial = useMemo<OverviewStatsSnapshot>(
    () => ({
      todayRevenue: contextRevenue,
      todayOrderCount: 0,
      todayAvgTicket: 0,
      yesterdayRevenue: 0,
      yesterdayOrderCount: 0,
      yesterdayAvgTicket: 0,
      activeSessions: 0,
      totalTables: 0,
      pendingWaiterCalls: 0,
    }),
    [contextRevenue]
  );
  const { todayRevenue } = useDashboardStats(statsInitial);
  const displayRevenue = todayRevenue;
  const { pendingOrders, pendingPaymentRequests, totalPendingAlerts } =
    useDashboardAlerts();
  const isOrdersPage = pathname.startsWith("/dashboard/orders");
  const isTablesPage = pathname.startsWith("/dashboard/tables");
  const headerAlertCount = isOrdersPage
    ? pendingOrders
    : isTablesPage
      ? pendingPaymentRequests
      : totalPendingAlerts;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-dash-border-subtle bg-dash-bg/95 px-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)] backdrop-blur-xl md:h-16 md:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <DashboardMobileMenu />
        <h1 className="truncate text-base font-semibold text-dash-text md:text-lg">
          {title}
        </h1>
        {headerAlertCount > 0 && (
          <NavNotificationBadge
            count={headerAlertCount}
            className="hidden sm:inline-flex"
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2.5 md:gap-3">
        {/* Revenue widget */}
        <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-surface px-3 py-1.5 shadow-[var(--shadow-xs)]">
          <TrendingUp className="size-3.5 text-emerald-500" />
          <span className="font-mono text-sm font-bold text-dash-accent">
            {formatPrice(displayRevenue, currency)}
          </span>
          <span className="hidden text-[11px] text-dash-text-muted sm:inline">today</span>
        </div>

        {/* Live indicator */}
        <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-2.5 py-1 lg:flex">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[11px] font-medium text-emerald-400">Live</span>
        </div>

        <SoundToggle />
        <PushOptIn />
      </div>
    </header>
  );
}
