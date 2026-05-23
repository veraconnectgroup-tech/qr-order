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
    pending: "bg-orange-500/15 text-orange-400",
    accepted: "bg-yellow-500/15 text-yellow-400",
    preparing: "bg-yellow-500/15 text-yellow-400",
    ready: "bg-emerald-500/15 text-emerald-400",
    delivered: "bg-zinc-700/50 text-zinc-400",
  };

  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        styles[status] ?? "bg-zinc-800 text-zinc-400"
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
    <div className="flex items-center justify-between border-b border-zinc-800/50 py-2 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-mono font-bold text-zinc-300">
          {formatOrderNumber(order.order_number)}
        </span>
        <span className="truncate text-xs text-zinc-500">{order.table_name}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={order.status} />
        <span className="text-sm font-mono font-semibold text-zinc-200">
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Live Orders</h3>
        <LiveConnectionBadge mode={realtimeMode} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-lg bg-zinc-800" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-500">
          No orders yet today
        </p>
      ) : (
        orders.map((order) => (
          <FeedRow key={order.id} order={order} currency={currency} />
        ))
      )}

      <Link
        href="/dashboard/orders"
        className="mt-3 block text-center text-xs text-orange-500 hover:text-orange-400"
      >
        View all orders →
      </Link>
    </div>
  );
}
