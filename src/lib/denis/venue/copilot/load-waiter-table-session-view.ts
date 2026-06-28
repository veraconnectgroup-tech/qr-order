import type { SupabaseClient } from "@supabase/supabase-js";
import { generateStaffAction } from "@/lib/denis/venue/copilot/generate-staff-actions";
import { buildWaiterTableSummary } from "@/lib/denis/venue/copilot/build-waiter-table-summary";
import {
  computeGuestWaitMinutes,
  extractWaiterSessionIntel,
} from "@/lib/denis/venue/copilot/extract-waiter-session-intel";
import { formatWaiterDenisTimeline } from "@/lib/denis/venue/copilot/format-waiter-denis-timeline";
import { loadDenisTimeline } from "@/lib/denis/platform/append-timeline-event";
import { loadConciergeConfigForLocation } from "@/lib/denis/config/load-concierge-config";
import { loadDenisSharedAiSessionId } from "@/lib/denis/venue/party";
import { isKitchenMenuSection } from "@/lib/kitchen/menu-section";
import { resolveWaiterUrgency } from "@/lib/denis/venue/copilot/resolve-waiter-urgency";
import type {
  WaiterDeviceOrderGroup,
  WaiterSessionIntel,
  WaiterTableSessionView,
} from "@/lib/denis/venue/copilot/waiter-copilot-types";

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  total: number;
  created_at: string;
  device_fingerprint: string | null;
  order_items: Array<{
    quantity: number;
    product_name: string;
    menu_section: string | null;
  }>;
};

type DeviceRow = {
  device_fingerprint: string;
  display_name: string | null;
};

function deviceLabel(
  fingerprint: string | null,
  devices: DeviceRow[]
): string {
  if (!fingerprint) return "Staff / unknown";
  const match = devices.find((row) => row.device_fingerprint === fingerprint);
  if (match?.display_name?.trim()) return match.display_name.trim();
  return `Guest ${fingerprint.slice(-4)}`;
}

function groupOrdersByDevice(
  orders: OrderRow[],
  devices: DeviceRow[]
): WaiterDeviceOrderGroup[] {
  const groups = new Map<string, WaiterDeviceOrderGroup>();

  for (const order of orders) {
    const key = order.device_fingerprint ?? "__staff__";
    const existing = groups.get(key) ?? {
      deviceLabel: deviceLabel(order.device_fingerprint, devices),
      deviceFingerprint: order.device_fingerprint,
      orders: [],
    };

    existing.orders.push({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      total: order.total,
      createdAt: order.created_at,
      items: (order.order_items ?? []).map((item) => ({
        quantity: item.quantity,
        productName: item.product_name,
      })),
    });

    groups.set(key, existing);
  }

  return [...groups.values()];
}

/** Table session view — per-device orders + Denis timeline for waiter detail. */
export async function loadWaiterTableSessionView(
  admin: SupabaseClient,
  input: {
    locationId: string;
    tableId: string;
    operatingMode?: "normal" | "rush" | "event";
  }
): Promise<WaiterTableSessionView | null> {
  const config = await loadConciergeConfigForLocation(input.locationId);
  if (!config.enabled) {
    return null;
  }

  const { data: tableRow } = await admin
    .from("tables")
    .select("id, name")
    .eq("id", input.tableId)
    .eq("location_id", input.locationId)
    .maybeSingle();

  if (!tableRow) return null;

  const table = tableRow as { id: string; name: string };

  const { data: sessionRow } = await admin
    .from("table_sessions")
    .select("id, opened_at")
    .eq("table_id", input.tableId)
    .eq("location_id", input.locationId)
    .eq("status", "active")
    .maybeSingle();

  const session = sessionRow as { id: string; opened_at: string } | null;

  const [{ data: orderRows }, { data: deviceRows }, { data: pendingCall }] =
    await Promise.all([
      admin
        .from("orders")
        .select(
          "id, order_number, status, total, created_at, device_fingerprint, order_items(quantity, product_name, menu_section)"
        )
        .eq("location_id", input.locationId)
        .eq("table_id", input.tableId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .neq("status", "rejected")
        .order("created_at", { ascending: false }),
      session
        ? admin
            .from("session_devices")
            .select("device_fingerprint, display_name")
            .eq("session_id", session.id)
        : Promise.resolve({ data: [] as DeviceRow[] }),
      admin
        .from("waiter_calls")
        .select("id")
        .eq("location_id", input.locationId)
        .eq("table_id", input.tableId)
        .eq("status", "pending")
        .limit(1),
    ]);

  const orders = (orderRows ?? []) as OrderRow[];
  const devices = (deviceRows ?? []) as DeviceRow[];
  const hasWaiterCall = Boolean((pendingCall ?? []).length);

  const guestWaitMinutes = computeGuestWaitMinutes({
    orders: orders.map((order) => ({
      status: order.status,
      created_at: order.created_at,
      hasKitchenItems: (order.order_items ?? []).some((item) =>
        isKitchenMenuSection(item.menu_section)
      ),
    })),
  });

  let intel: WaiterSessionIntel = {
    allergyLabels: [],
    frustrationLevel: "none",
    cartSummary: null,
    guestTopics: [],
  };
  let denisTimeline: WaiterTableSessionView["denisTimeline"] = [];

  if (session) {
    const aiSessionId = await loadDenisSharedAiSessionId(admin, session.id);
    if (aiSessionId) {
      const [timeline, { data: aiSession }] = await Promise.all([
        loadDenisTimeline(admin, aiSessionId),
        admin
          .from("ai_sessions")
          .select("order_draft")
          .eq("id", aiSessionId)
          .maybeSingle(),
      ]);

      intel = extractWaiterSessionIntel({
        timeline,
        orderDraft: (aiSession as { order_draft?: unknown } | null)?.order_draft,
      });
      denisTimeline = formatWaiterDenisTimeline(timeline);
    }
  }

  const action = generateStaffAction({
    operatingHint: null,
    openOrderCount: orders.filter((order) =>
      ["pending", "accepted", "preparing", "ready"].includes(order.status)
    ).length,
    seatedMinutes: session
      ? Math.round(
          (Date.now() - new Date(session.opened_at).getTime()) / 60_000
        )
      : null,
    hasActiveSession: Boolean(session),
    operatingMode: input.operatingMode ?? "normal",
    guestWaitMinutes,
    idleMinutes: null,
    allOrdersDelivered: false,
    minutesSinceLastDelivery: null,
    tableName: table.name,
    staffHintText: null,
  });

  const urgency = resolveWaiterUrgency({
    operatingHint: null,
    actionPriority: action?.actionPriority ?? null,
    hasWaiterCall,
    guestWaitMinutes,
    frustrationLevel: intel.frustrationLevel,
    allergyLabels: intel.allergyLabels,
  });

  return {
    tableId: table.id,
    tableName: table.name,
    enabled: true,
    summary: buildWaiterTableSummary({
      operatingHint: null,
      guestWaitMinutes,
      frustrationLevel: intel.frustrationLevel,
      allergyLabels: intel.allergyLabels,
      hasWaiterCall,
    }),
    urgency,
    suggestedAction: action?.suggestedAction ?? null,
    deviceOrders: groupOrdersByDevice(orders, devices),
    denisTimeline,
  };
}
