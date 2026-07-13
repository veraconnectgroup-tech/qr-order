"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Palette,
  Plug,
} from "lucide-react";
import { DenisBrandMark } from "@/components/design-system/denis-brand-mark";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/orgs", label: "Organizations", icon: Building2 },
  { href: "/platform/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/platform/denis-eval", label: "Denis eval", icon: FlaskConical },
  { href: "/platform/integrations", label: "Integrations", icon: Plug },
  { href: "/platform/design-system", label: "Design system", icon: Palette },
  { href: "/dashboard/orders", label: "Staff dashboard", icon: BarChart3 },
];

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-[260px] shrink-0 flex-col border-r border-dash-border-subtle bg-sidebar">
      <div className="space-y-2 border-b border-dash-border-subtle px-5 pb-4 pt-5">
        <DenisBrandMark />
        <p className="text-[11px] font-medium uppercase tracking-wider text-dash-text-disabled">
          Platform console
        </p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
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
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  active
                    ? "text-dash-accent"
                    : "text-dash-text-muted group-hover:text-dash-text-secondary"
                )}
                strokeWidth={1.75}
              />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-dash-border-subtle p-4">
        <form action={logoutAction}>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dash-border bg-dash-surface text-dash-text-secondary hover:bg-dash-surface-raised hover:text-dash-text"
            type="submit"
          >
            <LogOut className="me-2 size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
