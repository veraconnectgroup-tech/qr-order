"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FlaskConical,
  ClipboardList,
  LayoutGrid,
  Link2,
  MapPin,
  Megaphone,
  MessageSquare,
  Monitor,
  PartyPopper,
  ScrollText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tags,
  Ticket,
  Star,
  Users,
} from "lucide-react";
import { DenisNavIcon } from "@/components/design-system/denis-mark-badge";
import { AdminBrandMark } from "@/components/admin/admin-brand-mark";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { LocationSwitcher } from "@/components/dashboard/location-switcher";

const navItems = [
  { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/menu", label: "Menu", icon: ShoppingBag },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/tables", label: "Tables", icon: LayoutGrid },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/tagesabschluss", label: "Tagesabschluss", icon: ScrollText },
  { href: "/admin/fiskal/meldung", label: "Kassenmeldung", icon: ShieldCheck },
  { href: "/admin/audit-log", label: "Audit log", icon: ClipboardList },
  { href: "/admin/pos-integrations", label: "POS-Integration", icon: Monitor },
  { href: "/admin/table-mappings", label: "POS Tisch-Mapping", icon: Link2 },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const marketingItems = [
  { href: "/admin/promos", label: "Promo codes", icon: Ticket },
  { href: "/admin/upsells", label: "Upsell rules", icon: Megaphone },
  { href: "/admin/loyalty", label: "Loyalty", icon: Star },
  { href: "/admin/retention", label: "Retention", icon: Users },
  { href: "/admin/denis-insights", label: "Denis Insights", icon: DenisNavIcon },
  { href: "/admin/roi", label: "Denis ROI", icon: DenisNavIcon },
  { href: "/admin/denis-menu-agent", label: "Denis Menu Agent", icon: DenisNavIcon },
  { href: "/admin/denis-integrations", label: "Denis Integrations", icon: DenisNavIcon },
  { href: "/admin/integration-credentials", label: "Integration Credentials", icon: DenisNavIcon },
  { href: "/admin/integration-builder", label: "Integration Builder", icon: DenisNavIcon },
  { href: "/admin/denis", label: "Denis Config", icon: DenisNavIcon },
  { href: "/admin/ab-experiments", label: "A/B Experiments", icon: DenisNavIcon },
  { href: "/admin/events", label: "Events", icon: PartyPopper },
  { href: "/admin/denis-debug", label: "Denis Debugger", icon: Activity },
  { href: "/admin/denis-sim", label: "Venue Sim", icon: FlaskConical },
];

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150",
        active
          ? "bg-dash-accent-muted font-semibold text-dash-accent"
          : "text-dash-text-muted hover:bg-dash-surface hover:text-dash-text"
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          active
            ? "text-dash-accent"
            : "text-dash-text-muted group-hover:text-dash-text-secondary"
        )}
        strokeWidth={1.75}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AdminSidebar({
  locations = [],
  currentLocationId = "",
}: {
  locations?: Array<{ id: string; name: string }>;
  currentLocationId?: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-dash-border-subtle bg-sidebar">
      <div className="border-b border-dash-border-subtle px-5 pb-4 pt-5">
        <AdminBrandMark />
        {locations.length > 1 && currentLocationId && (
          <LocationSwitcher
            locations={locations}
            currentLocationId={currentLocationId}
          />
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(({ href, label, icon, exact }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={exact ? pathname === href : pathname.startsWith(href)}
          />
        ))}

        <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-dash-text-disabled">
          Denis & marketing
        </p>
        {marketingItems.map(({ href, label, icon }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={pathname.startsWith(href)}
          />
        ))}
      </nav>

      <div className="border-t border-dash-border-subtle p-4">
        <form action={logoutAction}>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dash-border bg-dash-surface text-dash-text-secondary hover:bg-dash-surface-raised hover:text-dash-text"
            type="submit"
          >
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
