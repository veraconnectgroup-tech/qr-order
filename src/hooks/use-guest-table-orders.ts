"use client";

import { useCallback, useEffect, useState } from "react";
import type { AiGuestOrder } from "@/lib/ai/order-context";

export function useGuestTableOrders(
  tableToken: string | null,
  sessionToken: string | null,
  enabled = true
) {
  const [orders, setOrders] = useState<AiGuestOrder[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!enabled || !tableToken || !sessionToken) {
      setOrders([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ sessionToken });
      const res = await fetch(
        `/api/tables/${tableToken}/orders?${params.toString()}`
      );
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const json = await res.json();
      setOrders((json.data?.orders ?? []) as AiGuestOrder[]);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, sessionToken, tableToken]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return { orders, loading, refresh };
}
