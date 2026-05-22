"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChefHat,
  Grid3X3,
  LayoutGrid,
  Settings,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

const navItems = [
  { href: "/dashboard/orders", label: "Orders", icon: LayoutGrid },
  { href: "/dashboard/kitchen", label: "Prep Display", icon: ChefHat },
  { href: "/dashboard/tables", label: "Tables", icon: Grid3X3 },
  { href: "/dashboard/waiter-calls", label: "Waiter Calls", icon: Bell },
  { href: "/dashboard/history", label: "History", icon: BarChart3 },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/staff", label: "Staff", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { orgName, staffName, staffRole } = useDashboard();

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 md:flex">
      <div className="border-b border-zinc-800 p-5">
        <p className="truncate font-bold text-zinc-50">{orgName}</p>
        <div className="mt-2 flex items-center gap-2">
          <span className="size-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium text-emerald-400">Open</span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 p-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-l-2 border-orange-500 bg-zinc-800/50 pl-[10px] text-white"
                  : "border-l-2 border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-4">
        <div className="rounded-lg bg-zinc-900 p-3">
          <p className="text-xs text-zinc-500">Staff</p>
          <p className="mt-1 truncate text-sm font-medium text-zinc-300">
            {staffName}
          </p>
          <p className="text-xs capitalize text-zinc-600">{staffRole}</p>
        </div>
      </div>
    </aside>
  );
}
