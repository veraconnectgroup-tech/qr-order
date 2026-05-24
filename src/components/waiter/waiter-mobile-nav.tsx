"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  Bell,
  Grid3X3,
  LayoutGrid,
  Plus,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { hapticLight } from "@/lib/haptics";

type Tab = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  alertKey?: "orders" | "calls" | "payments";
  prominent?: boolean;
};

const tabs: Tab[] = [
  { href: "/waiter", label: "Home", icon: Home, exact: true },
  {
    href: "/waiter/orders",
    label: "Orders",
    icon: LayoutGrid,
    alertKey: "orders",
  },
  {
    href: "/waiter/new-order",
    label: "New",
    icon: Plus,
    prominent: true,
  },
  {
    href: "/waiter/calls",
    label: "Calls",
    icon: Bell,
    alertKey: "calls",
  },
  {
    href: "/waiter/tables",
    label: "Tables",
    icon: Grid3X3,
    alertKey: "payments",
  },
];

export function WaiterMobileNav() {
  const pathname = usePathname();
  const { pendingOrders, pendingWaiterCalls, pendingPaymentRequests } =
    useDashboardAlerts();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-[calc(4rem+env(safe-area-inset-bottom,0px))] border-t border-dash-border-subtle bg-dash-bg/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
      {tabs.map(({ href, label, icon: Icon, alertKey, exact, prominent }) => {
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
            onClick={() => hapticLight()}
            className={cn(
              "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-dash-accent" : "text-dash-text-muted",
              prominent && "-mt-3"
            )}
          >
            <span
              className={cn(
                "relative flex size-10 items-center justify-center",
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
