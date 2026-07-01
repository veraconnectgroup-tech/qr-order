"use client";

import Link from "next/link";
import { useTransition } from "react";
import type { ComponentType } from "react";
import {
  Ban,
  ChefHat,
  Download,
  Grid3X3,
  PartyPopper,
  Plus,
  Receipt,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { activateDenisEventMode } from "@/lib/admin/denis-event-actions";

const QUICK_ACTIONS: Array<{
  id: string;
  href?: string;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  external?: boolean;
  managerOnly?: boolean;
  action?: "event-mode" | "z-bon";
}> = [
  {
    id: "new-order",
    href: "/dashboard/new-order",
    label: "New Order",
    description: "Staff entry",
    icon: Plus,
  },
  {
    id: "86-item",
    href: "/dashboard/menu",
    label: "86 Item",
    description: "Mark unavailable",
    icon: Ban,
    managerOnly: true,
  },
  {
    id: "event-mode",
    label: "Event Mode",
    description: "Start Denis event",
    icon: PartyPopper,
    managerOnly: true,
    action: "event-mode",
  },
  {
    id: "z-bon",
    label: "Force Z-Bon",
    description: "Daily fiscal close",
    icon: Receipt,
    managerOnly: true,
    action: "z-bon",
  },
  {
    id: "kds",
    href: "/dashboard/kitchen/kds",
    label: "Open KDS",
    description: "Wall display",
    icon: ChefHat,
  },
  {
    id: "tables",
    href: "/dashboard/tables",
    label: "View Tables",
    description: "Floor plan",
    icon: Grid3X3,
  },
  {
    id: "export",
    href: "/api/export/csv?preset=today",
    label: "Export Today",
    description: "Download CSV",
    icon: Download,
    external: true,
    managerOnly: true,
  },
];

export function OverviewQuickActions() {
  const { staffRole, locationId } = useDashboard();
  const [pending, startTransition] = useTransition();
  const canManage = staffRole === "owner" || staffRole === "manager";

  const actions = QUICK_ACTIONS.filter(
    (action) => !action.managerOnly || canManage
  );

  function runEventMode() {
    startTransition(async () => {
      const result = await activateDenisEventMode(true);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Event mode activated");
    });
  }

  function runForceZBon() {
    startTransition(async () => {
      const businessDate = new Date().toISOString().slice(0, 10);
      const response = await fetch("/api/fiscal/daily-closing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationId, businessDate }),
      });
      const json = (await response.json()) as { error?: string; message?: string };
      if (!response.ok) {
        toast.error(json.error ?? json.message ?? "Z-Bon failed");
        return;
      }
      toast.success("Z-Bon closing started");
    });
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map(({ id, href, label, description, icon: Icon, external, action }) => {
        const className =
          "flex items-center gap-3 rounded-xl border border-dash-border bg-dash-surface/50 p-4 transition hover:border-dash-accent/30 hover:bg-dash-surface-raised/50 disabled:opacity-60";
        const inner = (
          <>
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-dash-accent-muted">
              <Icon className="size-5 text-dash-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-dash-text-secondary">{label}</p>
              <p className="text-xs text-dash-text-disabled">{description}</p>
            </div>
          </>
        );

        if (action === "event-mode") {
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={runEventMode}
              className={className}
            >
              {inner}
            </button>
          );
        }

        if (action === "z-bon") {
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              onClick={runForceZBon}
              className={className}
            >
              {inner}
            </button>
          );
        }

        return external ? (
          <a key={id} href={href} className={className}>
            {inner}
          </a>
        ) : (
          <Link key={id} href={href ?? "#"} className={className}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
