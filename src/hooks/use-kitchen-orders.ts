"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderWithDetails } from "@/types";

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
    setOrders((data as unknown as OrderWithDetails[]) ?? []);
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

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      setLoading(true);
      await fetchOrders();
    }

    load();

    const channel = supabase
      .channel(`kitchen-orders:${locationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `location_id=eq.${locationId}`,
        },
        () => {
          if (!cancelled) fetchOrders();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED" && !cancelled) {
          fetchOrders();
        }
      });

    const pollId = setInterval(() => {
      if (!cancelled) fetchOrders();
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [locationId, fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}
