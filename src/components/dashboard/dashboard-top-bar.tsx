"use client";

import { usePathname } from "next/navigation";
import { getDashboardPageMeta } from "@/lib/dashboard/page-meta";
import { formatPrice } from "@/lib/format";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { SoundToggle } from "@/components/dashboard/sound-toggle";

export function DashboardTopBar() {
  const pathname = usePathname();
  const { title } = getDashboardPageMeta(pathname);
  const { currency } = useDashboard();
  const { todayOrderCount, todayRevenue } = useDashboardStats();
  const isOrdersPage = pathname.startsWith("/dashboard/orders");

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur-xl md:px-6">
      <h1 className="text-xl font-bold text-zinc-50">{title}</h1>

      <div className="flex items-center gap-3">
        {isOrdersPage && (
          <p className="hidden text-sm text-zinc-400 sm:block">
            Today:{" "}
            <span className="font-semibold text-zinc-200">
              {todayOrderCount} orders
            </span>
            {" · "}
            <span className="font-mono font-bold text-orange-500">
              {formatPrice(todayRevenue, currency)}
            </span>
          </p>
        )}
        {!isOrdersPage && (
          <div className="rounded-lg bg-zinc-900 px-3 py-1.5">
            <span className="text-xs text-zinc-500">Today </span>
            <span className="font-mono text-sm font-bold text-orange-500">
              {formatPrice(todayRevenue, currency)}
            </span>
          </div>
        )}
        {isOrdersPage && <SoundToggle />}
      </div>
    </header>
  );
}
