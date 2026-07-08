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
import { findOrderByIdempotencyKey } from "@/lib/orders/idempotency";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordSensitiveAction } from "@/lib/audit/record-sensitive-action";

type AdminClient = ReturnType<typeof createAdminClient>;

type CreateGuestOrderRpcResult = {
  order_id: string;
  order_number: number;
  total: number;
  tax_percent: number;
  already_existed: boolean;
};

function buildRpcItems(lineItems: ValidatedLineItem[]) {
  return lineItems.map((item) => ({
    product_id: item.productId,
    product_name: item.productName,
    quantity: item.quantity,
    unit_price:
      item.unitPrice + item.modifiers.reduce((sum, mod) => sum + mod.price, 0),
    notes: item.notes || null,
    total: item.itemTotal,
    menu_section: item.menuSection,
    tax_rate: item.taxRate,
    modifiers: item.modifiers.map((mod) => ({
      modifier_id: mod.modifierId,
      modifier_name: mod.modifierName,
      price: mod.price,
    })),
  }));
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

  const sanitizedNotes = input.notes ? sanitizeOrderNotes(input.notes) : null;

  const { data, error } = await admin.rpc("create_guest_order_tx", {
    p_location_id: table.location_id,
    p_table_id: table.id,
    p_session_id: sessionIdForMode(draft),
    p_status: isApproval ? "pending_approval" : "pending",
    p_requires_session: isApproval,
    p_idempotency_key: idempotencyKey,
    p_order_payload: {
      subtotal: pricing.subtotal,
      tax_percent: pricing.effectiveTaxPercent,
      tax_amount: pricing.taxAmount,
      total: pricing.finalTotal,
      discount_amount: pricing.discountAmount,
      is_takeaway: input.isTakeaway,
      notes: sanitizedNotes,
      device_fingerprint:
        draft.mode.kind === "approval" ? draft.mode.deviceFingerprint : null,
      payment_method: input.paymentMethod,
    },
    p_items: buildRpcItems(lineItems),
    p_promo_code_id: pricing.promoCodeId ?? null,
    p_consume_promo: !isApproval,
  });

  if (error || !data) {
    return err(createOrderError("internal", "Order could not be created.", 500));
  }

  const rpcResult = data as CreateGuestOrderRpcResult;

  if (!rpcResult.already_existed && pricing.discountAmount > 0) {
    await recordSensitiveAction(admin, {
      orderId: rpcResult.order_id,
      sessionId: sessionIdForMode(draft),
      action: "discount",
      targetType: "order",
      targetId: rpcResult.order_id,
      actorType: "guest",
      reason: pricing.promoCodeId ? "promo_code" : "discount",
      context: {
        discountAmount: pricing.discountAmount,
        promoCodeId: pricing.promoCodeId,
        subtotal: pricing.subtotal,
        finalTotal: pricing.finalTotal,
      },
      idempotencyKey: pricing.promoCodeId
        ? `discount:${rpcResult.order_id}:${pricing.promoCodeId}`
        : `discount:${rpcResult.order_id}`,
    });
  }

  if (rpcResult.already_existed && idempotencyKey) {
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

  return ok({
    orderId: rpcResult.order_id,
    orderNumber: rpcResult.order_number,
    total: rpcResult.total,
    taxPercent: rpcResult.tax_percent,
    tableName: table.name,
    currency,
    orgId: org.id,
    locationId: table.location_id,
    ...(isApproval ? { awaitingApproval: true as const } : {}),
  });
}
