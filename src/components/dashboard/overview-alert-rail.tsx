"use client";

import Link from "next/link";
import { AlertTriangle, Bell, CreditCard, LayoutGrid } from "lucide-react";
import { useDashboardAlerts } from "@/hooks/use-dashboard-alerts";

function AlertChip({
  href,
  label,
  count,
  icon: Icon,
}: {
  href: string;
  label: string;
  count: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  if (count <= 0) return null;

  return (
    <Link href={href} className="overview-v3-alert-chip">
      <Icon className="size-3.5 shrink-0 text-dash-text-muted" />
      <span className="font-semibold tabular-nums text-dash-text">{count}</span>
      <span className="text-dash-text-secondary">{label}</span>
    </Link>
  );
}

export function OverviewAlertRail() {
  const {
    pendingOrders,
    pendingWaiterCalls,
    pendingPaymentRequests,
    totalPendingAlerts,
  } = useDashboardAlerts();

  if (totalPendingAlerts <= 0) return null;

  return (
    <section
      className="flex shrink-0 items-center gap-4 border-b border-dash-border-subtle bg-dash-surface/40 px-4 py-2.5 sm:px-5"
      aria-label="Active alerts"
    >
      <span className="overview-v3-alert-label inline-flex items-center gap-2 whitespace-nowrap">
        <AlertTriangle className="size-3.5 text-amber-400/80" />
        Attention
      </span>

      <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto">
        <AlertChip
          href="/dashboard/orders"
          count={pendingOrders}
          label="open orders"
          icon={LayoutGrid}
        />
        <AlertChip
          href="/dashboard/waiter-calls"
          count={pendingWaiterCalls}
          label="waiter calls"
          icon={Bell}
        />
        <AlertChip
          href="/dashboard/tables"
          count={pendingPaymentRequests}
          label="pay requests"
          icon={CreditCard}
        />
      </div>

      <Link
        href="/dashboard/operations"
        className="overview-v3-link whitespace-nowrap"
      >
        Operations →
      </Link>
    </section>
  );
}
