"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChefHat,
  Grid3X3,
  LayoutDashboard,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

const tabs = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/orders", label: "Orders", icon: LayoutGrid, alertKey: "orders" as const },
  { href: "/dashboard/kitchen", label: "Prep", icon: ChefHat },
  { href: "/dashboard/tables", label: "Tables", icon: Grid3X3, alertKey: "payments" as const },
  { href: "/dashboard/waiter-calls", label: "Calls", icon: Bell, alertKey: "calls" as const },
  { href: "/dashboard/history", label: "History", icon: BarChart3 },
];

export function DashboardMobileNav() {
  const pathname = usePathname();
  const { pendingOrders, pendingWaiterCalls, pendingPaymentRequests } =
    useDashboardAlerts();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom,0px))] border-t border-dash-border-subtle bg-dash-bg/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      {tabs.map(({ href, label, icon: Icon, alertKey, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badgeCount =
          alertKey === "orders"
            ? pendingOrders + pendingPaymentRequests
            : alertKey === "calls"
              ? pendingWaiterCalls
              : alertKey === "payments"
                ? pendingPaymentRequests
                : 0;

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-dash-accent" : "text-dash-text-muted"
            )}
          >
            <span className="relative">
              <Icon className="size-5" />
              {badgeCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5">
                  <NavNotificationBadge count={badgeCount} />
                </span>
              )}
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
