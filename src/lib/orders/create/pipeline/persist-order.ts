import {
  err,
  ok,
  type OrderCreateError,
  type Result,
} from "@/lib/orders/create/result";
import { orderError as createOrderError } from "@/lib/orders/create/pipeline/errors";
import type {
  CreateOrderSuccess,
  OrderDraft,
  ValidatedLineItem,
} from "@/lib/orders/create/types";
import { sanitizeOrderNotes } from "@/lib/security/sanitize";
import {
  findOrderByIdempotencyKey,
  isIdempotencyUniqueViolation,
} from "@/lib/orders/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

const PREP_MINUTES = 8;

async function saveOrderItems(
  admin: AdminClient,
  orderId: string,
  lineItems: ValidatedLineItem[]
): Promise<Result<void, OrderCreateError>> {
  for (const item of lineItems) {
    const unitWithMods =
      item.unitPrice + item.modifiers.reduce((sum, mod) => sum + mod.price, 0);

    const { data: orderItem, error: itemError } = await admin
      .from("order_items")
      .insert({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: unitWithMods,
        notes: item.notes || null,
        total: item.itemTotal,
        menu_section: item.menuSection,
        tax_rate: item.taxRate,
      })
      .select("id")
      .single();

    if (itemError || !orderItem) {
      return err(
        createOrderError("internal", "Order items could not be saved.", 500)
      );
    }

    const orderItemId = (orderItem as { id: string }).id;

    if (item.modifiers.length) {
      const { error: modError } = await admin
        .from("order_item_modifiers")
        .insert(
          item.modifiers.map((mod) => ({
            order_item_id: orderItemId,
            modifier_id: mod.modifierId,
            modifier_name: mod.modifierName,
            price: mod.price,
          }))
        );

      if (modError) {
        return err(
          createOrderError("internal", "Order modifiers could not be saved.", 500)
        );
      }
    }
  }

  return ok(undefined);
}

function sessionIdForMode(draft: OrderDraft): string | null {
  if (draft.mode.kind === "approval") {
    return null;
  }
  return draft.mode.sessionId;
}

export async function persistOrder(
  admin: AdminClient,
  draft: OrderDraft,
  options?: { idempotencyKey?: string | null }
): Promise<Result<CreateOrderSuccess, OrderCreateError>> {
  const idempotencyKey = options?.idempotencyKey ?? null;
  const isApproval = draft.mode.kind === "approval";
  const { table, org } = draft.context;
  const { pricing, lineItems, input } = draft;
  const currency = org.currency ?? "EUR";

  const { data: orderNumber, error: numError } = await admin.rpc(
    "get_next_order_number",
    { p_location_id: table.location_id }
  );

  if (numError || orderNumber == null) {
    return err(
      createOrderError("internal", "Order number could not be generated.", 500)
    );
  }

  const sanitizedNotes = input.notes ? sanitizeOrderNotes(input.notes) : null;

  const { data: order, error: insertError } = await admin
    .from("orders")
    .insert({
      location_id: table.location_id,
      table_id: table.id,
      session_id: sessionIdForMode(draft),
      order_number: orderNumber as number,
      subtotal: pricing.subtotal,
      tax_percent: pricing.effectiveTaxPercent,
      tax_amount: pricing.taxAmount,
      total: pricing.finalTotal,
      discount_amount: pricing.discountAmount,
      promo_code_id: pricing.promoCodeId,
      is_takeaway: input.isTakeaway,
      notes: sanitizedNotes,
      estimated_prep_minutes: PREP_MINUTES,
      status: isApproval ? "pending_approval" : "pending",
      requires_session_open: isApproval,
      payment_status: "pending",
      payment_method: input.paymentMethod,
      tip_amount: 0,
      tip_staff_id: null,
      ...(draft.mode.kind === "approval"
        ? {
            device_fingerprint: draft.mode.deviceFingerprint,
            order_source: "qr" as const,
          }
        : {}),
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    })
    .select("id, order_number, total, tax_percent")
    .single();

  if (insertError || !order) {
    if (idempotencyKey && isIdempotencyUniqueViolation(insertError)) {
      const existing = await findOrderByIdempotencyKey(admin, idempotencyKey);
      if (existing) {
        return ok({
          orderId: existing.orderId,
          orderNumber: existing.orderNumber,
          total: existing.total,
          taxPercent: existing.taxPercent,
          tableName: existing.tableName,
          currency: existing.currency,
          orgId: existing.orgId,
          locationId: existing.locationId,
          ...(existing.awaitingApproval ? { awaitingApproval: true as const } : {}),
        });
      }
    }
    return err(createOrderError("internal", "Order could not be created.", 500));
  }

  const orderRow = order as {
    id: string;
    order_number: number;
    total: number;
    tax_percent: number;
  };

  const saveResult = await saveOrderItems(admin, orderRow.id, lineItems);
  if (!saveResult.ok) {
    await admin.from("orders").delete().eq("id", orderRow.id);
    return err(saveResult.error);
  }

  return ok({
    orderId: orderRow.id,
    orderNumber: orderRow.order_number,
    total: orderRow.total,
    taxPercent: orderRow.tax_percent,
    tableName: table.name,
    currency,
    orgId: org.id,
    locationId: table.location_id,
    ...(isApproval ? { awaitingApproval: true as const } : {}),
  });
}
