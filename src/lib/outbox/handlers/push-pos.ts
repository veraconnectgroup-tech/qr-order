import { createAdminClient } from "@/lib/supabase/admin";
import { getPosAdapter } from "@/lib/pos/adapter-registry";
import type {
  PosDeliveryResult,
  PosOrderItem,
  PosOrderPayload,
} from "@/lib/pos/types";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database";

type PushPosPayload = {
  orderId?: string;
  locationId?: string;
  orgId?: string;
  orderNumber?: number;
  tableName?: string;
  total?: number;
  paymentState?: "PAID" | "UNPAID";
  provider?: string;
  posIntegrationId?: string;
};

async function loadPosOrderItems(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string
): Promise<PosOrderItem[]> {
  const { data: items, error } = await admin
    .from("order_items")
    .select("id, product_name, quantity, unit_price, total, notes, tax_rate")
    .eq("order_id", orderId);

  if (error) {
    throw new Error(`POS order items query failed: ${error.message}`);
  }

  const itemRows = (items ?? []) as Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total: number;
    notes: string | null;
    tax_rate: number;
  }>;

  const itemIds = itemRows.map((item) => item.id);
  const modifiersByItem = new Map<
    string,
    Array<{ name: string; price: number }>
  >();

  if (itemIds.length > 0) {
    const { data: modifiers, error: modifiersError } = await admin
      .from("order_item_modifiers")
      .select("order_item_id, modifier_name, price")
      .in("order_item_id", itemIds);

    if (modifiersError) {
      throw new Error(
        `POS order modifiers query failed: ${modifiersError.message}`
      );
    }

    for (const mod of (modifiers ?? []) as Array<{
      order_item_id: string;
      modifier_name: string;
      price: number;
    }>) {
      const list = modifiersByItem.get(mod.order_item_id) ?? [];
      list.push({ name: mod.modifier_name, price: Number(mod.price) });
      modifiersByItem.set(mod.order_item_id, list);
    }
  }

  return itemRows.map((item) => ({
    name: item.product_name,
    quantity: item.quantity,
    unitPrice: Number(item.unit_price),
    total: Number(item.total),
    notes: item.notes,
    taxRate: Number(item.tax_rate ?? 19),
    modifiers: modifiersByItem.get(item.id) ?? [],
  }));
}

async function recordChannelDelivery(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    orderId: string;
    provider: string;
    result: PosDeliveryResult;
  }
) {
  const { data: existing } = await admin
    .from("order_channel_deliveries")
    .select("attempts")
    .eq("order_id", input.orderId)
    .eq("channel", "pos")
    .eq("provider", input.provider)
    .maybeSingle();

  const attempts =
    ((existing as { attempts: number } | null)?.attempts ?? 0) + 1;
  const now = new Date().toISOString();

  const { error } = await admin.from("order_channel_deliveries").upsert(
    {
      order_id: input.orderId,
      channel: "pos",
      provider: input.provider,
      status: input.result.success ? "delivered" : "failed",
      external_id: input.result.externalId ?? null,
      attempts,
      last_error: input.result.error ?? null,
      delivered_at: input.result.success ? now : null,
    },
    { onConflict: "order_id,channel,provider" }
  );

  if (error) {
    throw new Error(`order_channel_deliveries upsert failed: ${error.message}`);
  }
}

async function updateIntegrationAfterPush(
  admin: ReturnType<typeof createAdminClient>,
  integrationId: string,
  success: boolean,
  errorMessage?: string
) {
  const now = new Date().toISOString();
  const update = success
    ? {
        last_sync_at: now,
        last_error: null,
        status: "connected" as const,
        updated_at: now,
      }
    : {
        last_sync_at: now,
        last_error: errorMessage ?? "POS push failed",
        status: "error" as const,
        updated_at: now,
      };

  const { error } = await admin
    .from("pos_integrations")
    .update(update)
    .eq("id", integrationId);

  if (error) {
    logger.warn("POS integration status update failed", {
      integrationId,
      error: error.message,
    });
  }
}

export async function handleFulfillPushPos(
  payload: Record<string, unknown>
): Promise<void> {
  const data = payload as PushPosPayload;
  const orderId = data.orderId;
  const posIntegrationId = data.posIntegrationId;
  const provider = data.provider;

  if (!orderId || !posIntegrationId || !provider) {
    throw new Error("fulfill.push_pos missing required fields");
  }

  const admin = createAdminClient();

  const { data: integration, error: integrationError } = await admin
    .from("pos_integrations")
    .select("id, status, config, external_location_id, provider")
    .eq("id", posIntegrationId)
    .single();

  if (integrationError || !integration) {
    logger.warn("Outbox fulfill.push_pos skipped — integration not found", {
      orderId,
      posIntegrationId,
    });
    return;
  }

  const integrationRow = integration as {
    id: string;
    status: string;
    config: Json;
    external_location_id: string | null;
    provider: string;
  };

  if (integrationRow.status !== "connected") {
    logger.warn("Outbox fulfill.push_pos skipped — not connected", {
      orderId,
      posIntegrationId,
      status: integrationRow.status,
    });
    return;
  }

  const adapter = getPosAdapter(provider);
  if (!adapter) {
    logger.warn("Outbox fulfill.push_pos skipped — no adapter", {
      orderId,
      provider,
    });
    return;
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, created_at, location_id, total")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`fulfill.push_pos order not found: ${orderId}`);
  }

  const orderRow = order as {
    id: string;
    created_at: string;
    location_id: string;
    total: number;
  };

  const { data: location, error: locationError } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", orderRow.location_id)
    .single();

  if (locationError || !location) {
    throw new Error(`fulfill.push_pos location not found: ${orderRow.location_id}`);
  }

  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("currency")
    .eq("id", (location as { org_id: string }).org_id)
    .single();

  if (orgError || !org) {
    throw new Error("fulfill.push_pos organization not found");
  }

  const items = await loadPosOrderItems(admin, orderId);

  const posPayload: PosOrderPayload = {
    orderId,
    orderNumber: data.orderNumber ?? 0,
    locationId: data.locationId ?? orderRow.location_id,
    externalLocationId: integrationRow.external_location_id,
    tableName: data.tableName ?? "Table",
    total: Number(data.total ?? orderRow.total),
    currency: (org as { currency: string }).currency ?? "EUR",
    paymentState: data.paymentState ?? "UNPAID",
    items,
    createdAt: orderRow.created_at,
  };

  const config =
    integrationRow.config && typeof integrationRow.config === "object"
      ? (integrationRow.config as Record<string, unknown>)
      : {};

  let result: PosDeliveryResult;

  try {
    result = await adapter.pushOrder(posPayload, config);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = { success: false, error: message };
    await recordChannelDelivery(admin, { orderId, provider, result });
    await updateIntegrationAfterPush(admin, posIntegrationId, false, message);
    throw error;
  }

  await recordChannelDelivery(admin, { orderId, provider, result });

  if (!result.success) {
    const message = result.error ?? "POS push failed";
    await updateIntegrationAfterPush(admin, posIntegrationId, false, message);
    throw new Error(message);
  }

  await updateIntegrationAfterPush(admin, posIntegrationId, true);

  logger.info("Outbox fulfill.push_pos delivered", {
    orderId,
    provider,
    externalId: result.externalId,
  });
}
