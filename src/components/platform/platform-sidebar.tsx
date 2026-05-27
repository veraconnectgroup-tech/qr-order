"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FlaskConical,
  LayoutDashboard,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/platform/orgs", label: "Organizations", icon: Building2 },
  { href: "/platform/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/platform/denis-eval", label: "Denis eval", icon: FlaskConical },
  { href: "/dashboard/orders", label: "Staff dashboard", icon: BarChart3 },
];

export function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-violet-200 bg-white">
      <div className="flex h-16 items-center gap-2 border-b border-violet-200 px-5">
        <LayoutDashboard className="size-5 text-violet-600" />
        <span className="font-bold tracking-tight">Platform</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-violet-50 font-semibold text-violet-900"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-violet-200 p-4">
        <form action={logoutAction}>
          <Button variant="outline" size="sm" className="w-full" type="submit">
            <LogOut className="me-2 size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </aside>
  );
}
