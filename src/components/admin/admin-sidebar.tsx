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
  ScrollText,
  Settings,
  ShoppingBag,
  Sparkles,
  Tags,
  Ticket,
  Users,
} from "lucide-react";
import { AdminBrandMark } from "@/components/admin/admin-brand-mark";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { href: "/admin/locations", label: "Locations", icon: MapPin },
  { href: "/admin/menu", label: "Menu", icon: ShoppingBag },
  { href: "/admin/categories", label: "Categories", icon: Tags },
  { href: "/admin/tables", label: "Tables", icon: LayoutGrid },
  { href: "/admin/staff", label: "Staff", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/tagesabschluss", label: "Tagesabschluss", icon: ScrollText },
  { href: "/admin/audit-log", label: "Audit log", icon: ClipboardList },
  { href: "/admin/pos-integrations", label: "POS-Integration", icon: Monitor },
  { href: "/admin/table-mappings", label: "POS Tisch-Mapping", icon: Link2 },
  { href: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

const marketingItems = [
  { href: "/admin/promos", label: "Promo codes", icon: Ticket },
  { href: "/admin/upsells", label: "Upsell rules", icon: Megaphone },
  { href: "/admin/denis-insights", label: "Denis Insights", icon: Sparkles },
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

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-dash-border-subtle bg-sidebar">
      <div className="border-b border-dash-border-subtle px-5 pb-4 pt-5">
        <AdminBrandMark />
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
