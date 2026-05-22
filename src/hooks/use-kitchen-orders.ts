"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderWithDetails } from "@/types";

const ORDER_SELECT =
  "*, order_items(*, order_item_modifiers(*)), tables(name, zone:zones(name))";

export function useKitchenOrders(locationId: string) {
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("location_id", locationId)
      .in("status", ["accepted", "preparing"])
      .order("preparing_at", { ascending: true, nullsFirst: false });

    setOrders(sortKitchenOrders((data as unknown as OrderWithDetails[]) ?? []));
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      await fetchOrders();
      if (cancelled) return;
    })();

    const supabase = createClient();
    const channel = supabase
      .channel(`kitchen-realtime:${locationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `location_id=eq.${locationId}`,
        },
        async (payload) => {
          if (payload.eventType === "UPDATE") {
            const row = payload.new as { id: string; status: string };
            if (row.status !== "preparing" && row.status !== "accepted") {
              setOrders((prev) => prev.filter((o) => o.id !== row.id));
              return;
            }

            const { data } = await supabase
              .from("orders")
              .select(ORDER_SELECT)
              .eq("id", row.id)
              .single();

            if (data) {
              const order = data as unknown as OrderWithDetails;
              setOrders((prev) => {
                const exists = prev.some((o) => o.id === order.id);
                const next = exists
                  ? prev.map((o) => (o.id === order.id ? order : o))
                  : [...prev, order];
                return sortKitchenOrders(next);
              });
            }
            return;
          }

          if (payload.eventType === "INSERT") {
            const row = payload.new as { id: string; status: string };
            if (row.status !== "preparing" && row.status !== "accepted") return;

            const { data } = await supabase
              .from("orders")
              .select(ORDER_SELECT)
              .eq("id", row.id)
              .single();

            if (data) {
              const order = data as unknown as OrderWithDetails;
              setOrders((prev) => {
                if (prev.some((o) => o.id === order.id)) return prev;
                return sortKitchenOrders([...prev, order]);
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
}

function sortKitchenOrders(orders: OrderWithDetails[]) {
  return [...orders].sort((a, b) => {
    const aTime = a.preparing_at ?? a.accepted_at ?? a.created_at;
    const bTime = b.preparing_at ?? b.accepted_at ?? b.created_at;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });
}
