"use client";

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePostgresRealtime } from "@/hooks/use-postgres-realtime";
import {
  getDrinksOrderItems,
  getKitchenOrderItems,
} from "@/lib/kitchen/menu-section";
import { buildNewOrderAnnouncement } from "@/lib/denis/stations/new-order-announcement";
import {
  ORDER_WITH_DETAILS_SELECT,
  orderWithDetailsRows,
} from "@/lib/supabase/query-rows";

const RECENT_ORDERS_LIMIT = 20;

/**
 * ADR-053 M6 — announces new bons at the station as they arrive, opt-in
 * per location. Mirrors use-station-questions.ts's known-ids dedup
 * pattern (first fetch primes the set silently, only orders seen AFTER
 * that trigger an announcement) so a page refresh mid-shift never reads
 * out every order that's already in flight.
 */
export function useDenisNewOrderAnnouncements(input: {
  locationId: string;
  station: "kitchen" | "bar";
  enabled: boolean;
  onAnnouncement: (text: string) => void;
}) {
  const { locationId, station, enabled } = input;
  const knownIdsRef = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const onAnnouncementRef = useRef(input.onAnnouncement);
  onAnnouncementRef.current = input.onAnnouncement;

  const checkForNewOrders = useCallback(async () => {
    if (!enabled || !locationId) return;

    const supabase = createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_WITH_DETAILS_SELECT)
      .eq("location_id", locationId)
      .in("status", ["accepted", "preparing"])
      .order("created_at", { ascending: false })
      .limit(RECENT_ORDERS_LIMIT);

    if (error) return;
    const rows = orderWithDetailsRows(data);

    if (!initializedRef.current) {
      knownIdsRef.current = new Set(rows.map((row) => row.id));
      initializedRef.current = true;
      return;
    }

    for (const order of rows) {
      if (knownIdsRef.current.has(order.id)) continue;
      knownIdsRef.current.add(order.id);

      const items =
        station === "kitchen"
          ? getKitchenOrderItems(order)
          : getDrinksOrderItems(order);
      if (items.length === 0) continue;

      const text = buildNewOrderAnnouncement({
        tableName: order.tables?.name ?? "?",
        orderNumber: order.order_number,
        items: items.map((item) => ({
          productName: item.product_name,
          quantity: item.quantity,
        })),
      });
      if (text) onAnnouncementRef.current(text);
    }
  }, [enabled, locationId, station]);

  useEffect(() => {
    if (!enabled) {
      initializedRef.current = false;
      knownIdsRef.current = new Set();
      return;
    }
    void checkForNewOrders();
  }, [enabled, checkForNewOrders]);

  usePostgresRealtime({
    channelName: `denis-new-order-announce:${locationId}:${station}`,
    table: "orders",
    locationId,
    filter: `location_id=eq.${locationId}`,
    onChange: checkForNewOrders,
    enabled: enabled && Boolean(locationId),
  });
}
