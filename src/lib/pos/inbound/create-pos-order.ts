import {
  MAX_ITEMS_PER_ORDER,
  MAX_QUANTITY_PER_ITEM,
  validateOrderTotal,
} from "@/lib/security/order-limits";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import { persistOrderSideEffects } from "@/lib/outbox/persist-order-side-effects";
import { resolvePosTable } from "@/lib/pos/inbound/resolve-table";
import { touchPosIntegrationSync } from "@/lib/pos/inbound/audit";
import type {
  CreatePosOrderResult,
  PosInboundOrderDraft,
} from "@/lib/pos/inbound/types";
import type { PosProvider } from "@/lib/pos/pos-actions";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type IntegrationRow = {
  id: string;
  location_id: string;
  provider: PosProvider;
  status: string;
  config: Json;
};

export function buildPosOrderIdempotencyKey(
  provider: string,
  externalOrderId: string
) {
  return `pos:${provider}:${externalOrderId}`;
}

function buildIdempotencyKey(provider: string, externalOrderId: string) {
  return buildPosOrderIdempotencyKey(provider, externalOrderId);
}

function validateInboundItems(
  items: PosInboundOrderDraft["items"]
): string | null {
  if (!items.length) return "Order has no items";
  if (items.length > MAX_ITEMS_PER_ORDER) return "Too many items in order";

  for (const item of items) {
    if (item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM) {
      return `Invalid quantity for ${item.name}`;
    }
    if (!item.name.trim()) return "Item name is required";
  }

  return null;
}

export async function createPosOrder(
  integrationId: string,
  draft: PosInboundOrderDraft
): Promise<CreatePosOrderResult> {
  if (!draft.externalOrderId.trim()) {
    return { ok: false, status: 422, message: "Missing externalOrderId" };
  }

  const itemsError = validateInboundItems(draft.items);
  if (itemsError) {
    return { ok: false, status: 422, message: itemsError };
  }

  const totalError = validateOrderTotal(draft.total);
  if (totalError) {
    return { ok: false, status: 422, message: totalError };
  }

  const admin = createAdminClient();

  const { data: integration, error: integrationError } = await admin
    .from("pos_integrations")
    .select("id, location_id, provider, status, config")
    .eq("id", integrationId)
    .maybeSingle();

  if (integrationError || !integration) {
    return { ok: false, status: 404, message: "Integration not found" };
  }

  const row = integration as IntegrationRow;

  if (row.status !== "connected") {
    return { ok: false, status: 409, message: "Integration not connected" };
  }

  const config =
    row.config && typeof row.config === "object"
      ? (row.config as Record<string, unknown>)
      : {};

  if (config.inbound_enabled === false) {
    return { ok: false, status: 403, message: "Inbound orders disabled" };
  }

  const tableResult = await resolvePosTable({
    locationId: row.location_id,
    provider: row.provider,
    config,
    draft,
  });

  if ("error" in tableResult) {
    return { ok: false, status: 422, message: tableResult.error };
  }

  const { data: location } = await admin
    .from("locations")
    .select("org_id, accepting_orders")
    .eq("id", row.location_id)
    .maybeSingle();

  const locationRow = location as {
    org_id: string;
    accepting_orders: boolean;
  } | null;

  if (!locationRow) {
    return { ok: false, status: 404, message: "Location not found" };
  }

  if (!locationRow.accepting_orders) {
    return { ok: false, status: 400, message: "Location not accepting orders" };
  }

  const idempotencyKey = buildIdempotencyKey(
    row.provider,
    draft.externalOrderId.trim()
  );

  const paymentStatus = draft.paymentState === "PAID" ? "paid" : "pending";
  const paymentMethod =
    draft.paymentState === "PAID" ? "pos" : ("unset" as const);

  const orderPayload = {
    subtotal: draft.subtotal,
    tax_percent: draft.taxPercent,
    tax_amount: draft.taxAmount,
    total: draft.total,
    notes: draft.notes ? sanitizeOrderNotes(draft.notes) : null,
    payment_status: paymentStatus,
    payment_method: paymentMethod,
    status: draft.status ?? "accepted",
  };

  const itemsPayload = draft.items.map((item) => ({
    product_name: item.name.trim(),
    quantity: item.quantity,
    unit_price: item.unitPrice,
    total: item.total,
    notes: item.notes ? sanitizeOrderNotes(item.notes) : null,
    menu_section: "food",
    tax_rate: item.taxRate ?? draft.taxPercent ?? 19,
    modifiers: (item.modifiers ?? []).map((mod) => ({
      modifier_name: mod.name,
      price: mod.price,
    })),
  }));

  const { data: rpcData, error: rpcError } = await admin.rpc(
    "create_pos_order_tx",
    {
      p_pos_integration_id: row.id,
      p_location_id: row.location_id,
      p_table_id: tableResult.table.tableId,
      p_external_order_id: draft.externalOrderId.trim(),
      p_idempotency_key: idempotencyKey,
      p_order_payload: orderPayload,
      p_items: itemsPayload,
    }
  );

  if (rpcError) {
    logger.error("create_pos_order_tx failed", {
      integrationId,
      externalOrderId: draft.externalOrderId,
      error: rpcError.message,
    });
    await touchPosIntegrationSync(admin, row.id, rpcError.message);
    return { ok: false, status: 500, message: "Order could not be created" };
  }

  const result = rpcData as {
    order_id: string;
    order_number: number;
    total: number;
    session_id: string;
    already_existed: boolean;
  };

  if (!result.already_existed) {
    await persistOrderSideEffects(admin, {
      orderId: result.order_id,
      locationId: row.location_id,
      orgId: locationRow.org_id,
      orderNumber: result.order_number,
      tableName: tableResult.table.tableName,
      total: Number(result.total),
      paymentStatus,
      orderSource: "pos",
      phase: "created",
      actorType: "pos",
      actorId: row.id,
    });
  }

  await touchPosIntegrationSync(admin, row.id);

  logger.info("POS inbound order processed", {
    integrationId,
    externalOrderId: draft.externalOrderId,
    orderId: result.order_id,
    alreadyExisted: result.already_existed,
  });

  return {
    ok: true,
    orderId: result.order_id,
    orderNumber: result.order_number,
    total: Number(result.total),
    sessionId: result.session_id,
    alreadyExisted: result.already_existed,
    tableName: tableResult.table.tableName,
  };
}
