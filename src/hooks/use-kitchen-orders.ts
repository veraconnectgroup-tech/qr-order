"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import { useProvisionalPosOrders } from "@/hooks/use-provisional-pos-orders";
import {
  mergeKdsOrdersWithProvisionals,
  type ProvisionalKdsOrder,
} from "@/lib/pos/provisional-display";
import type { OrderWithDetails } from "@/types";
import { orderHasKitchenItems } from "@/lib/kitchen/menu-section";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name, zone:zones(name))";

export function useKitchenOrders(locationId: string) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locationRef = useRef(locationId);

  const fetchOrders = useCallback(async () => {
    if (!locationId) return;

    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("location_id", locationId)
      .in("status", ["accepted", "preparing"])
      .order("created_at", { ascending: true });

    if (fetchError) {
      console.error("Kitchen orders fetch failed:", fetchError.message);
      setError(fetchError.message);
      setLoading(false);
      return;
    }

    setError(null);
    const rows = (data as unknown as OrderWithDetails[]) ?? [];
    setOrders(rows.filter(orderHasKitchenItems));
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    locationRef.current = locationId;
  }, [locationId]);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchOrders();
  }, [locationId, fetchOrders]);

  const realtimeMode = usePostgresRealtime({
    channelName: `kitchen-orders:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: fetchOrders,
    enabled: Boolean(locationId),
  });

  const provisional = useProvisionalPosOrders(locationId);

  const displayOrders = useMemo(
    () =>
      mergeKdsOrdersWithProvisionals(orders, provisional.entries) as Array<
        OrderWithDetails | ProvisionalKdsOrder
      >,
    [orders, provisional.entries]
  );

  return {
    orders: displayOrders,
    serverOrders: orders,
    loading,
    error,
    refetch: fetchOrders,
    realtimeMode,
    provisionalEnabled: provisional.enabled,
    provisionalSyncFailedCount: provisional.syncFailedCount,
  };
}
