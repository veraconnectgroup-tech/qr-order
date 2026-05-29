"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  KDS_REALTIME_FALLBACK_POLL_MS,
  REALTIME_BACKUP_POLL_MS,
} from "@/lib/constants";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { KDS_DELIVERED_HIDE_MS } from "@/lib/kds/settings";
import { orderHasDrinksItems } from "@/lib/kitchen/menu-section";
import type { OrderWithDetails } from "@/types";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name, zone:zones(name))";

const ACTIVE_STATUSES = [
  "pending_approval",
  "pending",
  "accepted",
  "preparing",
  "ready",
] as const;

export function useBarOrders(locationId: string) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!locationId) return;

    const supabase = createClient();
    const deliveredCutoff = new Date(
      Date.now() - KDS_DELIVERED_HIDE_MS
    ).toISOString();

    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("location_id", locationId)
      .or(
        `status.in.(${ACTIVE_STATUSES.join(",")}),and(status.eq.delivered,delivered_at.gte.${deliveredCutoff})`
      )
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Bar orders fetch failed:", fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setError(null);
    const rows = (data as unknown as OrderWithDetails[]) ?? [];
    setOrders(rows.filter(orderHasDrinksItems));
    setLoading(false);
  }, [locationId]);

  const optimisticUpdateStatus = useCallback(
    (orderId: string, status: OrderWithDetails["status"]) => {
      const now = new Date().toISOString();
      setOrders((prev) =>
        prev.map((order) => {
          if (order.id !== orderId) return order;
          const patch: Partial<OrderWithDetails> = { status };
          if (status === "accepted") patch.accepted_at = now;
          if (status === "preparing") patch.preparing_at = now;
          if (status === "ready") patch.ready_at = now;
          if (status === "delivered") patch.delivered_at = now;
          return { ...order, ...patch };
        })
      );
    },
    []
  );

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchOrders();
  }, [locationId, fetchOrders]);

  usePostgresRealtime({
    channelName: `bar-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
    fallbackPollMs: KDS_REALTIME_FALLBACK_POLL_MS,
    backupPollMs: REALTIME_BACKUP_POLL_MS,
  });

  return {
    orders,
    loading,
    error,
    refetch: fetchOrders,
    optimisticUpdateStatus,
  };
}
