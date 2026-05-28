"use client";

import Link from "next/link";
import { LiveConnectionBadge } from "@/components/dashboard/live-connection-badge";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { QrCard, QrCardHeading } from "@/components/design-system";
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
  compact = false,
}: {
  order: OverviewLiveFeedOrder;
  currency: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-dash-border last:border-0",
        compact ? "py-1.5" : "py-2"
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            "font-mono font-bold text-dash-text-secondary",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {formatOrderNumber(order.order_number)}
        </span>
        <span
          className={cn(
            "truncate text-dash-text-disabled",
            compact ? "text-[11px]" : "text-xs"
          )}
        >
          {order.table_name}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={order.status} />
        <span
          className={cn(
            "font-mono font-semibold text-dash-text-secondary",
            compact ? "text-xs" : "text-sm"
          )}
        >
          {formatPrice(order.total, currency)}
        </span>
      </div>
    </div>
  );
}

export function OverviewLiveFeed({
  initialOrders,
  compact = false,
  maxOrders = 5,
}: {
  initialOrders?: OverviewLiveFeedOrder[];
  compact?: boolean;
  maxOrders?: number;
}) {
  const { currency } = useDashboard();
  const { loading, orders, realtimeMode } = useLiveOrdersFeed(initialOrders);
  const visibleOrders = orders.slice(0, maxOrders);

  return (
    <QrCard variant="muted" padding={compact ? "sm" : "md"}>
      <div className={cn("flex items-center justify-between", compact ? "mb-2" : "mb-3")}>
        <QrCardHeading className={compact ? "text-xs" : undefined}>
          Live Orders
        </QrCardHeading>
        <LiveConnectionBadge mode={realtimeMode} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: maxOrders }).map((_, i) => (
            <Skeleton
              key={i}
              className={cn(
                "rounded-lg bg-dash-surface-raised",
                compact ? "h-7" : "h-9"
              )}
            />
          ))}
        </div>
      ) : visibleOrders.length === 0 ? (
        <p
          className={cn(
            "text-center text-dash-text-disabled",
            compact ? "py-4 text-xs" : "py-6 text-sm"
          )}
        >
          No orders yet today
        </p>
      ) : (
        visibleOrders.map((order) => (
          <FeedRow
            key={order.id}
            order={order}
            currency={currency}
            compact={compact}
          />
        ))
      )}

      <Link
        href="/dashboard/orders"
        className="mt-3 block text-center text-xs text-dash-accent hover:text-dash-accent"
      >
        View all orders →
      </Link>
    </QrCard>
  );
}
