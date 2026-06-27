"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { useMemo } from "react";
import { DenisNavIcon } from "@/components/design-system/denis-mark-badge";
import {
  BarChart3,
  Bell,
  BookOpen,
  ChefHat,
  CreditCard,
  Grid3X3,
  LayoutDashboard,
  LayoutGrid,
  Plus,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LocationSwitcher } from "@/components/dashboard/location-switcher";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { NavNotificationBadge } from "@/components/dashboard/nav-notification-badge";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";
import { useStaffAccess } from "@/lib/auth/staff-access-context";
import { computeDashboardNavHrefs } from "@/lib/auth/staff-modules";
import type { PermissionKey } from "@/lib/auth/permission-catalog";
import type { StaffRole } from "@/types";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
  alertKey?: "orders" | "calls" | "payments";
  roles?: StaffRole[];
  requiresDenis?: boolean;
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
      {
        href: "/dashboard/denis",
        label: "Denis",
        icon: DenisNavIcon,
        requiresDenis: true,
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
      { href: "/dashboard/help", label: "Help", icon: BookOpen },
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
    aiConciergeEnabled,
  } = useDashboard();
  const { pendingOrders, pendingWaiterCalls, pendingPaymentRequests } =
    useDashboardAlerts();
  const clientAccess = useStaffAccess();

  const allowedDashboardHrefs = useMemo(() => {
    return computeDashboardNavHrefs({
      permissions: new Set(clientAccess.permissions as PermissionKey[]),
      allowedSurfaces: clientAccess.allowedSurfaces,
    });
  }, [clientAccess.permissions, clientAccess.allowedSurfaces]);

  const canManageBilling = ["owner", "manager"].includes(staffRole);
  const restrictByRegistry =
    staffRole === "waiter" ||
    clientAccess.primarySurface === "waiter" ||
    clientAccess.primarySurface === "bar" ||
    clientAccess.primarySurface === "kitchen";

  function isNavItemVisible(item: NavItem) {
    if (item.requiresDenis && !aiConciergeEnabled) {
      return false;
    }
    if (item.roles) {
      return item.roles.includes(staffRole as StaffRole);
    }
    if (restrictByRegistry) {
      return allowedDashboardHrefs.has(item.href);
    }
    return true;
  }

  function renderNavLink(item: NavItem) {
    const { href, label, icon: Icon, exact, alertKey } = item;
    const active = exact ? pathname === href : pathname.startsWith(href);
    const badgeCount =
      alertKey === "orders"
        ? pendingOrders
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
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
          active
            ? "bg-dash-accent-muted font-semibold text-dash-accent"
            : "text-dash-text-muted hover:bg-dash-surface hover:text-dash-text"
        )}
      >
        <span className="relative shrink-0">
          <Icon
            className={cn(
              "size-[18px] transition-colors",
              active
                ? "text-dash-accent"
                : "text-dash-text-muted group-hover:text-dash-text-secondary"
            )}
            strokeWidth={1.75}
          />
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
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-dash-border-subtle bg-sidebar md:flex">
      <div className="border-b border-dash-border-subtle px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          {orgLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={orgLogoUrl}
              alt=""
              className="size-9 shrink-0 rounded-lg object-cover ring-1 ring-dash-border"
            />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-dash-accent-muted">
              <UtensilsCrossed className="size-[18px] text-dash-accent" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-dash-text">{orgName}</p>
            <LocationSwitcher
              locations={accessibleLocations}
              currentLocationId={locationId}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-xs font-medium text-emerald-400">Open</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {navGroups.map((group, gi) => {
          const visibleItems = group.items.filter(isNavItemVisible);
          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={group.label} className={gi > 0 ? "mt-5" : "mt-2"}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-dash-text-disabled">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map((item) => renderNavLink(item))}
                {group.label === "Management" &&
                  canManageBilling &&
                  renderNavLink({
                    href: "/dashboard/billing",
                    label: "Billing",
                    icon: CreditCard,
                  })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-dash-border-subtle p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-dash-surface">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dash-surface-raised text-xs font-bold text-dash-text-secondary">
            {staffName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-dash-text-secondary">
              {staffName}
            </p>
            <p className="text-[11px] capitalize text-dash-text-muted">{staffRole}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
