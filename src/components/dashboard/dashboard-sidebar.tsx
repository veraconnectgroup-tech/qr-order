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
  Settings,
  CreditCard,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationSwitcher } from "@/components/dashboard/location-switcher";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
  alertKey?: "orders" | "calls" | "payments";
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Operations",
    items: [
      {
        href: "/dashboard",
        label: "Overview",
        icon: LayoutDashboard,
        exact: true,
      },
      {
        href: "/dashboard/orders",
        label: "Orders",
        icon: LayoutGrid,
        alertKey: "orders",
      },
      { href: "/dashboard/new-order", label: "New Order", icon: Plus },
      { href: "/dashboard/kitchen", label: "Prep Display", icon: ChefHat },
    ],
  },
  {
    label: "Floor",
    items: [
      {
        href: "/dashboard/tables",
        label: "Tables",
        icon: Grid3X3,
        alertKey: "payments",
      },
      {
        href: "/dashboard/waiter-calls",
        label: "Waiter Calls",
        icon: Bell,
        alertKey: "calls",
      },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/dashboard/history", label: "History", icon: BarChart3 },
      { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
      { href: "/dashboard/staff", label: "Staff", icon: Users },
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const {
    orgName,
    orgLogoUrl,
    staffName,
    staffRole,
    accessibleLocations,
    locationId,
  } = useDashboard();
  const { pendingOrders, pendingWaiterCalls, pendingPaymentRequests } =
    useDashboardAlerts();
  const canManageBilling = ["owner", "manager"].includes(staffRole);

  function renderNavLink(item: NavItem) {
    const { href, label, icon: Icon, exact, alertKey } = item;
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
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-orange-500/[0.08] font-semibold text-orange-400"
            : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        )}
      >
        <span className="relative shrink-0">
          <Icon className="size-4" />
          {badgeCount > 0 && (
            <span className="absolute -right-2 -top-2">
              <NavNotificationBadge count={badgeCount} />
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className="truncate">{label}</span>
          {badgeCount > 0 && (
            <NavNotificationBadge count={badgeCount} className="md:hidden" />
          )}
        </span>
      </Link>
    );
  }

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <div className="border-b border-zinc-800 p-5">
        <div className="flex items-center gap-3">
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogoUrl}
              alt=""
              className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-zinc-800"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 ring-1 ring-orange-500/20">
              <UtensilsCrossed className="size-5 text-orange-500" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-zinc-50">{orgName}</p>
            <LocationSwitcher
              locations={accessibleLocations}
              currentLocationId={locationId}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-emerald-400">Open</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => renderNavLink(item))}
              {group.label === "Management" && canManageBilling &&
                renderNavLink({
                  href: "/dashboard/billing",
                  label: "Billing",
                  icon: CreditCard,
                })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-zinc-900/80 px-3 py-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-300">
            {staffName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-200">
              {staffName}
            </p>
            <p className="text-[11px] capitalize text-zinc-500">{staffRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
