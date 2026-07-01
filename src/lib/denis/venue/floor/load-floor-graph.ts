import type { SupabaseClient } from "@supabase/supabase-js";
import { composeFloorGraphHouse } from "@/lib/denis/venue/floor/compose-floor-graph-house";
import { countActiveStaffOnFloor } from "@/lib/denis/venue/floor/count-active-staff-on-floor";
import { deriveTableOperatingHint } from "@/lib/denis/venue/floor/derive-table-hint";
import type {
  FloorGraph,
  FloorGraphTable,
} from "@/lib/denis/venue/floor/types";
import type { VenueOperatingMode } from "@/lib/denis/venue/ops/types";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";

type TableRow = { id: string };

type SessionRow = {
  id: string;
  table_id: string;
  opened_at: string;
  denis_shared_ai_session_id: string | null;
};

type OrderRow = {
  id: string;
  table_id: string | null;
  session_id: string | null;
  status: string;
  created_at: string;
  accepted_at: string | null;
  preparing_at: string | null;
  delivered_at: string | null;
  order_items: Array<{ menu_section: string | null }>;
};

type PartyActivityRow = {
  table_session_id: string;
  last_active_at: string;
};

type LocationRow = {
  denis_operating_mode: VenueOperatingMode;
};

/** Build live floor graph snapshot for a location (M14). */
export async function loadFloorGraph(
  admin: SupabaseClient,
  locationId: string,
  options?: { backlogThresholdMinutes?: number }
): Promise<FloorGraph> {
  const threshold = options?.backlogThresholdMinutes ?? 20;
  const now = new Date().toISOString();
  const nowMs = Date.now();

  const [
    { data: locationRow },
    { data: tableRows },
    { data: sessionRows },
    { data: orderRows },
    { data: partyRows },
    staffOnFloor,
  ] = await Promise.all([
    admin
      .from("locations")
      .select("denis_operating_mode")
      .eq("id", locationId)
      .maybeSingle(),
    admin
      .from("tables")
      .select("id")
      .eq("location_id", locationId)
      .eq("is_active", true),
    admin
      .from("table_sessions")
      .select("id, table_id, opened_at, denis_shared_ai_session_id")
      .eq("location_id", locationId)
      .eq("status", "active"),
    admin
      .from("orders")
      .select(
        "id, table_id, session_id, status, created_at, accepted_at, preparing_at, delivered_at, order_items(menu_section)"
      )
      .eq("location_id", locationId)
      .in("status", [
        "pending",
        "accepted",
        "preparing",
        "ready",
        "delivered",
      ]),
    admin
      .from("denis_party_devices")
      .select("table_session_id, last_active_at")
      .eq("location_id", locationId),
    countActiveStaffOnFloor(admin, locationId),
  ]);

  const location = locationRow as LocationRow | null;
  const tables = (tableRows ?? []) as TableRow[];
  const sessions = (sessionRows ?? []) as SessionRow[];
  const orders = (orderRows ?? []) as OrderRow[];
  const partyActivity = (partyRows ?? []) as PartyActivityRow[];

  const sessionByTable = new Map<string, SessionRow>();
  for (const session of sessions) {
    sessionByTable.set(session.table_id, session);
  }

  const activityBySession = new Map<string, string>();
  for (const row of partyActivity) {
    const prev = activityBySession.get(row.table_session_id);
    if (!prev || row.last_active_at > prev) {
      activityBySession.set(row.table_session_id, row.last_active_at);
    }
  }

  const ordersByTable = new Map<string, OrderRow[]>();
  for (const order of orders) {
    if (!order.table_id) continue;
    const list = ordersByTable.get(order.table_id) ?? [];
    list.push(order);
    ordersByTable.set(order.table_id, list);
  }

  const floorTables: FloorGraphTable[] = tables.map((table) => {
    const session = sessionByTable.get(table.id) ?? null;
    const tableOrders = ordersByTable.get(table.id) ?? [];
    const openOrderCount = tableOrders.filter((order) =>
      ["pending", "accepted", "preparing", "ready"].includes(order.status)
    ).length;

    const seatedMinutes = session
      ? Math.round(
          (nowMs - new Date(session.opened_at).getTime()) / 60_000
        )
      : null;

    const lastGuestActivityAt = session
      ? (activityBySession.get(session.id) ?? session.opened_at)
      : null;

    const orderSnapshots = tableOrders.map((order) => ({
      status: order.status,
      created_at: order.created_at,
      delivered_at: order.delivered_at,
      hasKitchenItems: (order.order_items ?? []).some((item) =>
        isKitchenMenuSection(item.menu_section)
      ),
      hasDessert: (order.order_items ?? []).some(
        (item) => item.menu_section === "desserts"
      ),
    }));

    const operatingHint = deriveTableOperatingHint({
      sessionOpenedAt: session?.opened_at ?? null,
      orders: orderSnapshots,
      lastGuestActivityAt,
      backlogThresholdMinutes: threshold,
      nowMs,
    });

    return {
      tableId: table.id,
      tableSessionId: session?.id ?? null,
      seatedMinutes,
      openOrderCount,
      lastGuestActivityAt,
      aiSessionId: session?.denis_shared_ai_session_id ?? null,
      operatingHint,
    };
  });

  const house = composeFloorGraphHouse({
    operatingMode: location?.denis_operating_mode ?? "normal",
    orders,
    staffOnFloor,
    nowMs,
  });

  return {
    locationId,
    at: now,
    tables: floorTables,
    house,
  };
}

export function floorTableForId(
  floor: FloorGraph,
  tableId: string
): FloorGraphTable | null {
  return floor.tables.find((table) => table.tableId === tableId) ?? null;
}
