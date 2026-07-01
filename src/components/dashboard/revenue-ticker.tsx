"use client";

import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function RevenueTicker({
  currency,
  revenue,
  orderCount,
  avgTicket,
  loading,
}: {
  currency: string;
  revenue: number;
  orderCount: number;
  avgTicket: number;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Skeleton className="h-14 w-full rounded-xl bg-dash-surface-raised" />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-dash-border",
        "bg-gradient-to-r from-dash-surface via-dash-surface-raised/40 to-dash-surface px-4 py-3"
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      <p className="font-mono text-lg font-bold tabular-nums text-[var(--qr-ember)] sm:text-xl">
        {formatPrice(revenue, currency)}
        <span className="ms-2 text-sm font-medium text-dash-text-muted">
          today
        </span>
      </p>
      <span className="hidden h-4 w-px bg-dash-border sm:block" aria-hidden />
      <p className="text-sm tabular-nums text-dash-text-secondary">
        <span className="font-semibold text-dash-text">{orderCount}</span>{" "}
        orders
      </p>
      <span className="hidden h-4 w-px bg-dash-border md:block" aria-hidden />
      <p className="text-sm tabular-nums text-dash-text-secondary">
        <span className="font-semibold text-dash-text">
          {formatPrice(avgTicket, currency)}
        </span>{" "}
        avg
      </p>
    </div>
  );
}
