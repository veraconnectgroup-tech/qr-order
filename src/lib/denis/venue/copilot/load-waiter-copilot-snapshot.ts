import type { SupabaseClient } from "@supabase/supabase-js";
import { generateStaffAction } from "@/lib/denis/venue/copilot/generate-staff-actions";
import { loadStaffCopilotSnapshot } from "@/lib/denis/venue/copilot/load-staff-copilot-snapshot";
import { buildWaiterHandoffContext } from "@/lib/denis/venue/copilot/build-waiter-handoff-context";
import { buildWaiterTableSummary } from "@/lib/denis/venue/copilot/build-waiter-table-summary";
import {
  computeGuestWaitMinutes,
  extractWaiterSessionIntel,
} from "@/lib/denis/venue/copilot/extract-waiter-session-intel";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";
import { loadStaffNotifications } from "@/lib/denis/notifications/persist-staff-notification";
import {
  resolveWaiterUrgency,
  waiterUrgencySortRank,
} from "@/lib/denis/venue/copilot/resolve-waiter-urgency";
import type {
  WaiterCopilotSnapshot,
  WaiterCopilotTableRow,
  WaiterHandoffAlert,
  WaiterSessionIntel,
} from "@/lib/denis/venue/copilot/waiter-copilot-types";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";

type SessionRow = {
  table_id: string;
  denis_shared_ai_session_id: string | null;
};

type OrderRow = {
  table_id: string | null;
  status: string;
  created_at: string;
  order_items: Array<{ menu_section: string | null }>;
};

type AiSessionRow = {
  id: string;
  table_id: string;
  order_draft: unknown;
};

const HANDOFF_NOTIFICATION_TYPES = [
  "waiter_call",
  "allergy_alert",
  "denis_escalation",
  "long_wait",
] as const;

function isHandoffNotificationType(type: string): boolean {
  return (HANDOFF_NOTIFICATION_TYPES as readonly string[]).includes(type);
}

function enrichWaiterTableRow(input: {
  table: import("@/lib/denis/venue/copilot/types").StaffCopilotTableRow;
  intel: WaiterSessionIntel | null;
  guestWaitMinutes: number | null;
  hasWaiterCall: boolean;
  operatingMode: WaiterCopilotSnapshot["operatingMode"];
}): WaiterCopilotTableRow {
  const baseTable = input.table;
  const intel = input.intel;
  const action = generateStaffAction({
    operatingHint: baseTable.operatingHint,
    openOrderCount: baseTable.openOrderCount,
    seatedMinutes: baseTable.seatedMinutes,
    hasActiveSession: baseTable.hasActiveSession,
    operatingMode: input.operatingMode,
    guestWaitMinutes: input.guestWaitMinutes,
    idleMinutes:
      baseTable.operatingHint === "idle" ? baseTable.seatedMinutes : null,
    allOrdersDelivered: baseTable.openOrderCount === 0 && baseTable.hasActiveSession,
    minutesSinceLastDelivery: null,
    tableName: baseTable.tableName,
    staffHintText: baseTable.staffHint?.text ?? null,
  });

  const frustrationLevel = intel?.frustrationLevel ?? "none";
  const allergyLabels = intel?.allergyLabels ?? [];

  const urgency = resolveWaiterUrgency({
    operatingHint: baseTable.operatingHint,
    actionPriority: action?.actionPriority ?? null,
    hasWaiterCall: input.hasWaiterCall,
    guestWaitMinutes: input.guestWaitMinutes,
    frustrationLevel,
    allergyLabels,
  });

  return {
    ...baseTable,
    summary: buildWaiterTableSummary({
      operatingHint: baseTable.operatingHint,
      guestWaitMinutes: input.guestWaitMinutes,
      frustrationLevel,
      allergyLabels,
      hasWaiterCall: input.hasWaiterCall,
    }),
    urgency,
    suggestedAction: action?.suggestedAction ?? null,
    actionPriority: action?.actionPriority ?? null,
    guestWaitMinutes: input.guestWaitMinutes,
  };
}

function sortWaiterPriorityTables(tables: WaiterCopilotTableRow[]): WaiterCopilotTableRow[] {
  return [...tables].sort((a, b) => {
    const urgencyDiff = waiterUrgencySortRank(a.urgency) - waiterUrgencySortRank(b.urgency);
    if (urgencyDiff !== 0) return urgencyDiff;
    const waitA = a.guestWaitMinutes ?? -1;
    const waitB = b.guestWaitMinutes ?? -1;
    if (waitA !== waitB) return waitB - waitA;
    return a.tableName.localeCompare(b.tableName);
  });
}

/** Waiter-facing Denis copilot snapshot with summaries + handoff context. */
export async function loadWaiterCopilotSnapshot(
  admin: SupabaseClient,
  input: {
    locationId: string;
    orgId: string;
    staffRole: string;
  }
): Promise<WaiterCopilotSnapshot> {
  const [base, config, notifications] = await Promise.all([
    loadStaffCopilotSnapshot(admin, {
      locationId: input.locationId,
      staffRole: input.staffRole,
    }),
    loadConciergeConfigForLocation(input.locationId),
    loadStaffNotifications(admin, {
      orgId: input.orgId,
      locationId: input.locationId,
      limit: 12,
      unreadOnly: true,
    }),
  ]);

  if (!base.enabled) {
    return {
      ...base,
      priorityTables: [],
      tables: [],
      handoffAlerts: [],
    };
  }

  const [{ data: sessionRows }, { data: orderRows }, { data: pendingCalls }] =
    await Promise.all([
      admin
        .from("table_sessions")
        .select("table_id, denis_shared_ai_session_id")
        .eq("location_id", input.locationId)
        .eq("status", "active"),
      admin
        .from("orders")
        .select("table_id, status, created_at, order_items(menu_section)")
        .eq("location_id", input.locationId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .neq("status", "rejected"),
      admin
        .from("waiter_calls")
        .select("table_id")
        .eq("location_id", input.locationId)
        .eq("status", "pending"),
    ]);

  const sessions = (sessionRows ?? []) as SessionRow[];
  const aiSessionIds = sessions
    .map((row) => row.denis_shared_ai_session_id)
    .filter((id): id is string => Boolean(id));

  const aiSessionByTable = new Map<string, string>();
  for (const session of sessions) {
    if (session.denis_shared_ai_session_id) {
      aiSessionByTable.set(session.table_id, session.denis_shared_ai_session_id);
    }
  }

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

  const intelByTable = new Map<string, WaiterSessionIntel>();
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

  const ordersByTable = new Map<string, OrderRow[]>();
  for (const order of (orderRows ?? []) as OrderRow[]) {
    if (!order.table_id) continue;
    const list = ordersByTable.get(order.table_id) ?? [];
    list.push(order);
    ordersByTable.set(order.table_id, list);
  }

  const pendingCallTableIds = new Set(
    ((pendingCalls ?? []) as Array<{ table_id: string }>).map((row) => row.table_id)
  );

  const enrichedTables = base.tables.map((table) => {
    const tableOrders = ordersByTable.get(table.tableId) ?? [];
    const guestWaitMinutes = computeGuestWaitMinutes({
      orders: tableOrders.map((order) => ({
        status: order.status,
        created_at: order.created_at,
        hasKitchenItems: (order.order_items ?? []).some((item) =>
          isKitchenMenuSection(item.menu_section)
        ),
      })),
    });

    return enrichWaiterTableRow({
      table,
      intel: intelByTable.get(table.tableId) ?? null,
      guestWaitMinutes,
      hasWaiterCall: pendingCallTableIds.has(table.tableId),
      operatingMode: base.operatingMode,
    });
  });

  const priorityTables = sortWaiterPriorityTables(
    enrichedTables.filter(
      (table) =>
        table.urgency !== "green" ||
        table.operatingHint != null ||
        table.openOrderCount > 0 ||
        table.staffHint != null ||
        table.suggestedAction != null
    )
  );

  const handoffAlerts: WaiterHandoffAlert[] = notifications
    .filter((row) => isHandoffNotificationType(row.type))
    .map((row) => ({
      id: row.id,
      tableId: row.tableId,
      tableName: row.tableName,
      type: row.type,
      priority: row.priority,
      message: row.message,
      contextLine: buildWaiterHandoffContext({
        tableName: row.tableName ?? "—",
        baseMessage: row.message,
        notificationType: row.type,
        intel: row.tableId ? intelByTable.get(row.tableId) ?? null : null,
      }),
      actionUrl: row.actionUrl,
      createdAt: row.createdAt,
    }));

  return {
    ...base,
    autoRushBacklogMinutes: config.ops.autoRushBacklogMinutes,
    tables: enrichedTables,
    priorityTables,
    handoffAlerts,
  };
}
