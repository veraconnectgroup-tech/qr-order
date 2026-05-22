"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  ChefHat,
  Grid3X3,
  LayoutGrid,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard/orders", label: "Orders", icon: LayoutGrid },
  { href: "/dashboard/kitchen", label: "Prep", icon: ChefHat },
  { href: "/dashboard/tables", label: "Tables", icon: Grid3X3 },
  { href: "/dashboard/waiter-calls", label: "Calls", icon: Bell },
  { href: "/dashboard/history", label: "History", icon: BarChart3 },
];

export function DashboardMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 border-t border-zinc-800 bg-zinc-950 pb-[env(safe-area-inset-bottom,0px)] md:hidden">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium",
              active ? "text-orange-500" : "text-zinc-500"
            )}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
