"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  BarChart3,
  Bell,
  ChefHat,
  Grid3X3,
  LayoutDashboard,
  LayoutGrid,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { hapticLight } from "@/lib/haptics";

type Tab = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  alertKey?: "orders" | "calls" | "payments";
  prominent?: boolean;
};

const defaultTabs: Tab[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: LayoutGrid,
    alertKey: "orders",
  },
  { href: "/dashboard/kitchen", label: "Prep", icon: ChefHat },
  {
    href: "/dashboard/tables",
    label: "Tables",
    icon: Grid3X3,
    alertKey: "payments",
  },
  {
    href: "/dashboard/waiter-calls",
    label: "Calls",
    icon: Bell,
    alertKey: "calls",
  },
  { href: "/dashboard/history", label: "History", icon: BarChart3 },
];

const waiterDashboardTabs: Tab[] = [
  {
    href: "/dashboard/tables",
    label: "Tables",
    icon: Grid3X3,
    alertKey: "payments",
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: LayoutGrid,
    alertKey: "orders",
  },
  {
    href: "/dashboard/new-order",
    label: "New",
    icon: Plus,
    prominent: true,
  },
  {
    href: "/dashboard/waiter-calls",
    label: "Calls",
    icon: Bell,
    alertKey: "calls",
  },
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
];

function badgeCountForTab(
  alertKey: Tab["alertKey"],
  pendingOrders: number,
  pendingWaiterCalls: number,
  pendingPaymentRequests: number
) {
  if (alertKey === "orders") {
    return pendingOrders + pendingPaymentRequests;
  }
  if (alertKey === "calls") {
    return pendingWaiterCalls;
  }
  if (alertKey === "payments") {
    return pendingPaymentRequests;
  }
  return 0;
}

export function DashboardMobileNav() {
  const pathname = usePathname();
  const { staffRole } = useDashboard();
  const { pendingOrders, pendingWaiterCalls, pendingPaymentRequests } =
    useDashboardAlerts();

  const tabs = staffRole === "waiter" ? waiterDashboardTabs : defaultTabs;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom,0px))] border-t border-dash-border-subtle bg-dash-bg/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      {tabs.map(({ href, label, icon: Icon, alertKey, exact, prominent }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        const badgeCount = badgeCountForTab(
          alertKey,
          pendingOrders,
          pendingWaiterCalls,
          pendingPaymentRequests
        );

        return (
          <Link
            key={href}
            href={href}
            onClick={() => hapticLight()}
            className={cn(
              "relative flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-dash-accent" : "text-dash-text-muted",
              prominent && "-mt-3"
            )}
          >
            <span
              className={cn(
                "relative flex items-center justify-center",
                prominent &&
                  "size-12 rounded-full bg-dash-accent text-white shadow-lg shadow-dash-accent/30"
              )}
            >
              <Icon className={cn("size-5", prominent && "size-6")} />
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
