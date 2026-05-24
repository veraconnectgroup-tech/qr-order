"use client";

import { TrendingUp } from "lucide-react";
import { usePathname } from "next/navigation";
import { getDashboardPageMeta } from "@/lib/dashboard/page-meta";
import { formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { DashboardMobileMenu } from "@/components/dashboard/dashboard-mobile-menu";
import { SoundToggle } from "@/components/dashboard/sound-toggle";
import { PushOptIn } from "@/components/dashboard/push-opt-in";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

export function DashboardTopBar() {
  const pathname = usePathname();
  const { title } = getDashboardPageMeta(pathname);
  const { currency, todayRevenue: contextRevenue } = useDashboard();
  const { todayRevenue, loading: statsLoading } = useDashboardStats();
  const displayRevenue = statsLoading ? contextRevenue : todayRevenue;
  const { pendingOrders, pendingPaymentRequests, totalPendingAlerts } =
    useDashboardAlerts();
  const isOrdersPage = pathname.startsWith("/dashboard/orders");
  const ordersAlertCount = pendingOrders + pendingPaymentRequests;
  const headerAlertCount = isOrdersPage ? ordersAlertCount : totalPendingAlerts;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-800/50 bg-zinc-950/90 px-3 shadow-[0_1px_3px_rgba(0,0,0,0.3)] backdrop-blur-xl md:h-16 md:gap-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <DashboardMobileMenu />
        <h1 className="truncate text-base font-bold text-zinc-50 md:text-xl">
          {title}
        </h1>
        {headerAlertCount > 0 && (
          <NavNotificationBadge
            count={headerAlertCount}
            className="hidden sm:inline-flex"
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5">
          <TrendingUp className="size-3.5 text-emerald-500" />
          <span className="font-mono text-sm font-bold text-orange-500">
            {formatPrice(displayRevenue, currency)}
          </span>
          <span className="hidden text-xs text-zinc-500 sm:inline">today</span>
        </div>
        <SoundToggle />
        <PushOptIn />
      </div>
    </header>
  );
}
