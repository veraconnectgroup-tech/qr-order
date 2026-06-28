import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import {
  buildStaffTableBrief,
  resolveTableRevenueOpportunity,
} from "@/lib/denis/venue/copilot/build-staff-table-brief";
import {
  computeGuestWaitMinutes,
  extractWaiterSessionIntel,
} from "@/lib/denis/venue/copilot/extract-waiter-session-intel";
import { resolveStaffCopilotTablePriority } from "@/lib/denis/venue/copilot/resolve-table-priority";
import type { StaffCopilotTableRow } from "@/lib/denis/venue/copilot/types";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";

type SessionRow = {
  table_id: string;
  id: string;
  denis_shared_ai_session_id: string | null;
};

type OrderRow = {
  table_id: string | null;
  session_id: string | null;
  status: string;
  created_at: string;
  order_items: Array<{
    menu_section: string | null;
    unit_price: number | string;
    quantity: number | string;
  }>;
};

type AiSessionRow = {
  id: string;
  table_id: string;
  order_draft: unknown;
};

type PartyDeviceRow = {
  table_session_id: string;
};

function sumSessionCheckEuros(orders: OrderRow[]): number {
  let total = 0;
  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      total += Number(item.unit_price) * Number(item.quantity);
    }
  }
  return Math.round(total * 100) / 100;
}

export type StaffCopilotTableContext = {
  guestWaitMinutes: number | null;
  frustrationLevel: "none" | "mild" | "high";
  guestTopics: string[];
  cartSummary: string | null;
  sessionCheckEuros: number | null;
  partySize: number | null;
};

const EMPTY_CONTEXT: StaffCopilotTableContext = {
  guestWaitMinutes: null,
  frustrationLevel: "none",
  guestTopics: [],
  cartSummary: null,
  sessionCheckEuros: null,
  partySize: null,
};

export function enrichStaffCopilotTableRow(
  table: Omit<
    StaffCopilotTableRow,
    "priority" | "guestWaitMinutes" | "staffBrief" | "revenueOpportunity"
  >,
  context: StaffCopilotTableContext = EMPTY_CONTEXT
): StaffCopilotTableRow {
  const priority = resolveStaffCopilotTablePriority({
    operatingHint: table.operatingHint,
    guestWaitMinutes: context.guestWaitMinutes,
    frustrationLevel: context.frustrationLevel,
    hasActiveSession: table.hasActiveSession,
    openOrderCount: table.openOrderCount,
  });

  const staffBrief = buildStaffTableBrief({
    tableName: table.tableName,
    guestTopics: context.guestTopics,
    cartSummary: context.cartSummary,
    guestWaitMinutes: context.guestWaitMinutes,
    sessionCheckEuros: context.sessionCheckEuros,
    partySize: context.partySize,
    operatingHint: table.operatingHint,
    staffHintText: table.staffHint?.text ?? null,
    frustrationLevel: context.frustrationLevel,
  });

  const revenueOpportunity = resolveTableRevenueOpportunity({
    tableName: table.tableName,
    sessionCheckEuros: context.sessionCheckEuros,
    operatingHint: table.operatingHint,
    hasActiveSession: table.hasActiveSession,
  });

  return {
    ...table,
    priority,
    guestWaitMinutes: context.guestWaitMinutes,
    staffBrief,
    revenueOpportunity,
  };
}

/** Load session intel + check totals for staff copilot table rows (M15). */
export async function loadStaffCopilotTableContexts(
  admin: SupabaseClient,
  input: {
    locationId: string;
    floor: FloorGraph;
  }
): Promise<Map<string, StaffCopilotTableContext>> {
  const contexts = new Map<string, StaffCopilotTableContext>();
  const activeTableIds = input.floor.tables
    .filter((table) => table.tableSessionId)
    .map((table) => table.tableId);

  if (activeTableIds.length === 0) return contexts;

  const sessionByTable = new Map<string, SessionRow>();
  for (const floorTable of input.floor.tables) {
    if (!floorTable.tableSessionId) continue;
    sessionByTable.set(floorTable.tableId, {
      table_id: floorTable.tableId,
      id: floorTable.tableSessionId,
      denis_shared_ai_session_id: floorTable.aiSessionId,
    });
  }

  const sessionIds = [...sessionByTable.values()].map((row) => row.id);

  const [{ data: orderRows }, { data: partyRows }] = await Promise.all([
    admin
      .from("orders")
      .select(
        "table_id, session_id, status, created_at, order_items(menu_section, unit_price, quantity)"
      )
      .eq("location_id", input.locationId)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .neq("status", "rejected"),
    sessionIds.length > 0
      ? admin
          .from("denis_party_devices")
          .select("table_session_id")
          .in("table_session_id", sessionIds)
      : Promise.resolve({ data: [] as PartyDeviceRow[] }),
  ]);

  const ordersByTable = new Map<string, OrderRow[]>();
  for (const order of (orderRows ?? []) as OrderRow[]) {
    if (!order.table_id) continue;
    const list = ordersByTable.get(order.table_id) ?? [];
    list.push(order);
    ordersByTable.set(order.table_id, list);
  }

  const partySizeBySession = new Map<string, number>();
  for (const row of (partyRows ?? []) as PartyDeviceRow[]) {
    partySizeBySession.set(
      row.table_session_id,
      (partySizeBySession.get(row.table_session_id) ?? 0) + 1
    );
  }

  const aiSessionIds = [...sessionByTable.values()]
    .map((row) => row.denis_shared_ai_session_id)
    .filter((id): id is string => Boolean(id));

  const { data: aiSessionRows } =
    aiSessionIds.length > 0
      ? await admin
          .from("ai_sessions")
          .select("id, table_id, order_draft")
          .in("id", aiSessionIds)
      : { data: [] as AiSessionRow[] };

  const draftByAiSession = new Map<string, unknown>();
  const tableByAiSession = new Map<string, string>();
  for (const row of (aiSessionRows ?? []) as AiSessionRow[]) {
    draftByAiSession.set(row.id, row.order_draft);
    tableByAiSession.set(row.id, row.table_id);
  }

  const intelByTable = new Map<
    string,
    ReturnType<typeof extractWaiterSessionIntel>
  >();
  await Promise.all(
    aiSessionIds.map(async (aiSessionId) => {
      const timeline = await loadDenisTimeline(admin, aiSessionId);
      const tableId = tableByAiSession.get(aiSessionId);
      if (!tableId) return;
      intelByTable.set(
        tableId,
        extractWaiterSessionIntel({
          timeline,
          orderDraft: draftByAiSession.get(aiSessionId),
        })
      );
    })
  );

  for (const tableId of activeTableIds) {
    const session = sessionByTable.get(tableId);
    const tableOrders = ordersByTable.get(tableId) ?? [];
    const intel = intelByTable.get(tableId);

    const guestWaitMinutes = computeGuestWaitMinutes({
      orders: tableOrders.map((order) => ({
        status: order.status,
        created_at: order.created_at,
        hasKitchenItems: (order.order_items ?? []).some((item) =>
          isKitchenMenuSection(item.menu_section)
        ),
      })),
    });

    const sessionOrders = session
      ? tableOrders.filter((order) => order.session_id === session.id)
      : tableOrders;

    const sessionCheckEuros =
      sessionOrders.length > 0 ? sumSessionCheckEuros(sessionOrders) : null;

    contexts.set(tableId, {
      guestWaitMinutes,
      frustrationLevel: intel?.frustrationLevel ?? "none",
      guestTopics: intel?.guestTopics ?? [],
      cartSummary: intel?.cartSummary ?? null,
      sessionCheckEuros,
      partySize: session ? (partySizeBySession.get(session.id) ?? null) : null,
    });
  }

  return contexts;
}
