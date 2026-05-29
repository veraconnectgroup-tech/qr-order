"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { useBarOrders } from "@/hooks/use-bar-orders";
import { BarOrderRow } from "@/components/bar/bar-order-row";
import { cn } from "@/lib/utils";

export function BarDrinkQueue() {
  const { locationId, currency } = useDashboard();
  const { orders, loading, error, refetch, optimisticUpdateStatus } =
    useBarOrders(locationId);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-36 rounded-xl bg-dash-surface-raised"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center text-sm text-red-300">
        Failed to load drink queue: {error}
      </p>
    );
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-dash-border-subtle px-4 py-12 text-center text-sm text-dash-text-muted">
        No drink orders in queue
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-dash-text">Drink queue</h1>
        <button
          type="button"
          onClick={() => void refetch()}
          className="min-h-12 rounded-lg px-3 text-sm font-medium text-orange-400 hover:bg-dash-surface-raised"
        >
          Refresh
        </button>
      </div>
      <div className={cn("space-y-3")}>
        {orders.map((order) => (
          <BarOrderRow
            key={order.id}
            order={order}
            currency={currency}
            busy={busyOrderId === order.id}
            onBusyChange={(busy) => setBusyOrderId(busy ? order.id : null)}
            onUpdated={() => void refetch()}
            onOptimisticStatus={optimisticUpdateStatus}
          />
        ))}
      </div>
    </div>
  );
}
