"use client";

import Link from "next/link";
import type { ComponentType } from "react";
import { ChefHat, Download, Grid3X3, Plus } from "lucide-react";
import { useDashboard } from "@/components/dashboard/dashboard-provider";

const QUICK_ACTIONS: Array<{
  href: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  external?: boolean;
  managerOnly?: boolean;
}> = [
  {
    href: "/dashboard/new-order",
    label: "New Order",
    description: "Staff entry",
    icon: Plus,
  },
  {
    href: "/dashboard/kitchen/kds",
    label: "Open KDS",
    description: "Wall display",
    icon: ChefHat,
  },
  {
    href: "/dashboard/tables",
    label: "View Tables",
    description: "Floor plan",
    icon: Grid3X3,
  },
  {
    href: "/api/export/csv?preset=today",
    label: "Export Today",
    description: "Download CSV",
    icon: Download,
    external: true,
    managerOnly: true,
  },
];

export function OverviewQuickActions() {
  const { staffRole } = useDashboard();
  const canExport = staffRole === "owner" || staffRole === "manager";

  const actions = QUICK_ACTIONS.filter(
    (action) => !action.managerOnly || canExport
  );

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(({ href, label, description, icon: Icon, external }) => {
        const className =
          "flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-orange-500/30 hover:bg-zinc-800/50";
        const inner = (
          <>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
              <Icon className="size-5 text-orange-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-200">{label}</p>
              <p className="text-xs text-zinc-500">{description}</p>
            </div>
          </>
        );

        return external ? (
          <a key={href} href={href} className={className}>
            {inner}
          </a>
        ) : (
          <Link key={href} href={href} className={className}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
