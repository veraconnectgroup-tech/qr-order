"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Plus, Settings, UtensilsCrossed, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

const links = [
  { href: "/dashboard/new-order", label: "New Order", icon: Plus },
  { href: "/dashboard/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardMobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { orgName, staffName } = useDashboard();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-50 bg-black/60 md:hidden"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-0 top-0 z-50 border-b border-zinc-800 bg-zinc-950 p-4 shadow-xl md:hidden">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold text-zinc-100">{orgName}</p>
                <p className="truncate text-sm text-zinc-500">{staffName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-4 space-y-1">
              {links.map(({ href, label, icon: Icon }) => {
                const active = pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium",
                      active
                        ? "bg-zinc-800 text-orange-500"
                        : "text-zinc-300 hover:bg-zinc-900"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </>
  );
}
