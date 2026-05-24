"use client";

import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import type { RealtimeMode } from "@/hooks/use-postgres-realtime";

/**
 * Subscribes to order changes for a location via Supabase Realtime
 * (with polling fallback). Used by dashboard order views; returns
 * connection mode — callers refetch orders in `onChange`.
 */
export function useRealtimeOrders(
  locationId: string,
  onChange: () => void,
  options?: { enabled?: boolean }
): RealtimeMode {
  return usePostgresRealtime({
    channelName: `orders-realtime:${locationId}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange,
    enabled: options?.enabled ?? Boolean(locationId),
  });
}
