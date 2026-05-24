"use client";

import Link from "next/link";
import { LiveConnectionBadge } from "@/components/dashboard/live-connection-badge";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useLiveOrdersFeed } from "@/hooks/use-live-orders-feed";
import type { OverviewLiveFeedOrder } from "@/lib/dashboard/overview-types";
import { formatOrderNumber, formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const label =
    status === "pending"
      ? "New"
      : status === "delivered"
        ? "Delivered"
        : status.charAt(0).toUpperCase() + status.slice(1);

  const styles: Record<string, string> = {
    pending: "bg-dash-accent/15 text-dash-accent",
    accepted: "bg-yellow-500/15 text-yellow-400",
    preparing: "bg-yellow-500/15 text-yellow-400",
    ready: "bg-emerald-500/15 text-emerald-400",
    delivered: "bg-dash-surface-overlay/50 text-dash-text-muted",
  };

  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        styles[status] ?? "bg-dash-surface-raised text-dash-text-muted"
      )}
    >
      {label}
    </span>
  );
}

function FeedRow({
  order,
  currency,
}: {
  order: OverviewLiveFeedOrder;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-dash-border py-2 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-mono font-bold text-dash-text-secondary">
          {formatOrderNumber(order.order_number)}
        </span>
        <span className="truncate text-xs text-dash-text-disabled">{order.table_name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={order.status} />
        <span className="text-sm font-mono font-semibold text-dash-text-secondary">
          {formatPrice(order.total, currency)}
        </span>
      </div>
    </div>
  );
}

export function OverviewLiveFeed({
  initialOrders,
}: {
  initialOrders?: OverviewLiveFeedOrder[];
}) {
  const { currency } = useDashboard();
  const { loading, orders, realtimeMode } = useLiveOrdersFeed(initialOrders);

  return (
    <div className="rounded-xl border border-dash-border bg-dash-surface/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-dash-text-secondary">Live Orders</h3>
        <LiveConnectionBadge mode={realtimeMode} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg bg-dash-surface-raised" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-dash-text-disabled">
          No orders yet today
        </p>
      ) : (
        orders.map((order) => (
          <FeedRow key={order.id} order={order} currency={currency} />
        ))
      )}

      <Link
        href="/dashboard/orders"
        className="mt-3 block text-center text-xs text-dash-accent hover:text-dash-accent"
      >
        View all orders →
      </Link>
    </div>
  );
}
