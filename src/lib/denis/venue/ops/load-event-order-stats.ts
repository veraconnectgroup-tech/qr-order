import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventCopilotStats } from "@/lib/denis/venue/ops/event-mode";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";

type OrderItemRow = {
  product_name: string;
  quantity: number;
};

type OrderRow = {
  order_items: OrderItemRow[] | null;
};

/** Aggregate event copilot stats from floor + recent orders. */
export async function loadEventCopilotStats(
  admin: SupabaseClient,
  input: {
    locationId: string;
    floor: FloorGraph;
    lookbackHours?: number;
    nowMs?: number;
  }
): Promise<EventCopilotStats> {
  const activeTables = input.floor.tables.filter((table) => table.tableSessionId);
  const orderedGuestCount = activeTables.filter(
    (table) => table.openOrderCount > 0
  ).length;
  const activeSessionCount = activeTables.length;
  const tablesWithoutOrder = Math.max(
    0,
    activeSessionCount - orderedGuestCount
  );

  const lookbackHours = input.lookbackHours ?? 4;
  const since = new Date(
    (input.nowMs ?? Date.now()) - lookbackHours * 60 * 60 * 1000
  ).toISOString();

  const { data: orders } = await admin
    .from("orders")
    .select("order_items(product_name, quantity)")
    .eq("location_id", input.locationId)
    .gte("created_at", since)
    .not("status", "in", '("cancelled","rejected")');

  const counts = new Map<string, number>();
  for (const order of (orders ?? []) as OrderRow[]) {
    for (const item of order.order_items ?? []) {
      const name = item.product_name?.trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + (item.quantity ?? 1));
    }
  }

  const topProducts = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  return {
    orderedGuestCount,
    activeSessionCount,
    tablesWithoutOrder,
    topProducts,
  };
}

/** Count table_sessions opened recently (QR scan proxy). */
export async function loadRecentSessionOpens(
  admin: SupabaseClient,
  input: {
    locationId: string;
    windowMs?: number;
    nowMs?: number;
  }
): Promise<Array<{ at: string }>> {
  const windowMs = input.windowMs ?? 10 * 60_000;
  const since = new Date((input.nowMs ?? Date.now()) - windowMs).toISOString();

  const { data: sessions } = await admin
    .from("table_sessions")
    .select("opened_at")
    .eq("location_id", input.locationId)
    .gte("opened_at", since)
    .order("opened_at", { ascending: false })
    .limit(50);

  return ((sessions ?? []) as Array<{ opened_at: string }>).map((row) => ({
    at: row.opened_at,
  }));
}
