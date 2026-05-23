"use client";

import { usePathname } from "next/navigation";
import { getDashboardPageMeta } from "@/lib/dashboard/page-meta";
import { formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { DashboardMobileMenu } from "@/components/dashboard/dashboard-mobile-menu";
import { SoundToggle } from "@/components/dashboard/sound-toggle";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

export function DashboardTopBar() {
  const pathname = usePathname();
  const { title } = getDashboardPageMeta(pathname);
  const { currency } = useDashboard();
  const { todayOrderCount, todayRevenue } = useDashboardStats();
  const { pendingOrders, pendingPaymentRequests } = useDashboardAlerts();
  const isOrdersPage = pathname.startsWith("/dashboard/orders");
  const ordersAlertCount = pendingOrders + pendingPaymentRequests;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/80 px-3 backdrop-blur-xl md:h-16 md:gap-3 md:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <DashboardMobileMenu />
        <h1 className="truncate text-base font-bold text-zinc-50 md:text-xl">
          {title}
        </h1>
        {ordersAlertCount > 0 && (
          <NavNotificationBadge count={ordersAlertCount} className="hidden sm:inline-flex" />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        {isOrdersPage && (
          <>
            <p className="hidden text-sm text-zinc-400 lg:block">
              Today:{" "}
              <span className="font-semibold text-zinc-200">
                {todayOrderCount} orders
              </span>
              {" · "}
              <span className="font-mono font-bold text-orange-500">
                {formatPrice(todayRevenue, currency)}
              </span>
            </p>
            <p className="font-mono text-xs font-bold text-orange-500 sm:hidden">
              {formatPrice(todayRevenue, currency)}
            </p>
          </>
        )}
        {!isOrdersPage && (
          <div className="rounded-lg bg-zinc-900 px-2 py-1 md:px-3 md:py-1.5">
            <span className="hidden text-xs text-zinc-500 sm:inline">Today </span>
            <span className="font-mono text-xs font-bold text-orange-500 md:text-sm">
              {formatPrice(todayRevenue, currency)}
            </span>
          </div>
        )}
        <SoundToggle />
      </div>
    </header>
  );
}
