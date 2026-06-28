"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { REALTIME_FALLBACK_POLL_MS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  parseWaiterDetailOrders,
  startOfTodayIso,
} from "@/lib/dashboard/waiter-table-data";
import { WAITER_ORDERS_LIST_SELECT } from "@/lib/supabase/query-rows";
import {
  WaiterOrderRow,
  type WaiterDetailOrder,
} from "@/components/waiter/waiter-order-row";
import { usePullToRefresh } from "@/components/waiter/use-pull-to-refresh";
import { useWaiterI18n } from "@/hooks/use-waiter-i18n";
import { cn } from "@/lib/utils";

const ORDER_SELECT = WAITER_ORDERS_LIST_SELECT;

export function WaiterOrdersList() {
  const { locationId, currency, staffRole } = useDashboard();
  const { t } = useWaiterI18n();
  const [orders, setOrders] = useState<WaiterDetailOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const canUpdateStatus = !["kitchen"].includes(staffRole);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("location_id", locationId)
      .gte("created_at", startOfTodayIso())
      .in("status", [
        "pending_approval",
        "pending",
        "accepted",
        "preparing",
        "ready",
      ])
      .order("created_at", { ascending: false });

    setOrders(parseWaiterDetailOrders(data));
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  usePostgresRealtime({
    channelName: `waiter-orders-list:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: load,
    fallbackPollMs: REALTIME_FALLBACK_POLL_MS,
  });

  const { bind, indicator, refreshing } = usePullToRefresh({
    onRefresh: load,
    disabled: loading,
    hint: t("pull.hint"),
    release: t("pull.release"),
    refreshingLabel: t("pull.refreshing"),
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-28 rounded-xl bg-dash-surface-raised"
          />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div {...bind}>
        {indicator}
        <p className="rounded-xl border border-dashed border-dash-border-subtle px-4 py-10 text-center text-sm text-dash-text-muted">
          {t("empty.noActiveOrders")}
        </p>
      </div>
    );
  }

  return (
    <div {...bind}>
      {indicator}
      <div
        className={cn(
          "space-y-3 transition-opacity",
          refreshing && "opacity-70"
        )}
      >
        {orders.map((order) => (
          <WaiterOrderRow
            key={order.id}
            order={order}
            currency={currency}
            canUpdateStatus={canUpdateStatus}
            onUpdated={load}
            onOptimisticStatus={(orderId, status) => {
              setOrders((current) =>
                status === "delivered"
                  ? current.filter((row) => row.id !== orderId)
                  : current.map((row) =>
                      row.id === orderId ? { ...row, status } : row
                    )
              );
            }}
          />
        ))}
      </div>
    </div>
  );
}
