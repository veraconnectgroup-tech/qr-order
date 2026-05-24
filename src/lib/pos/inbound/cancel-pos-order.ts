import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export type CancelPosOrderResult =
  | {
      ok: true;
      orderId: string;
      orderNumber: number;
      alreadyCancelled: boolean;
    }
  | { ok: false; status: number; message: string };

const TERMINAL_STATUSES = new Set([
  "cancelled",
  "rejected",
  "delivered",
]);

export async function cancelPosInboundOrder(
  integrationId: string,
  externalOrderId: string
): Promise<CancelPosOrderResult> {
  const trimmedExternalId = externalOrderId.trim();
  if (!trimmedExternalId) {
    return { ok: false, status: 422, message: "Missing externalOrderId" };
  }

  const admin = createAdminClient();

  const { data: link } = await admin
    .from("pos_order_links")
    .select("order_id")
    .eq("pos_integration_id", integrationId)
    .eq("external_order_id", trimmedExternalId)
    .maybeSingle();

  if (!link) {
    return {
      ok: true,
      orderId: "",
      orderNumber: 0,
      alreadyCancelled: true,
    };
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, status, payment_status")
    .eq("id", link.order_id)
    .maybeSingle();

  if (!order) {
    return { ok: false, status: 404, message: "Linked order not found" };
  }

  if (TERMINAL_STATUSES.has(order.status)) {
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.order_number,
      alreadyCancelled: true,
    };
  }

  if (order.payment_status === "paid" || order.payment_status === "pos_online") {
    return {
      ok: false,
      status: 409,
      message: "Cannot cancel a paid POS order",
    };
  }

  const { error } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      rejection_reason: "Cancelled by POS",
    })
    .eq("id", order.id);

  if (error) {
    logger.error("POS order cancel failed", {
      integrationId,
      externalOrderId: trimmedExternalId,
      orderId: order.id,
      error: error.message,
    });
    return { ok: false, status: 500, message: "Order could not be cancelled" };
  }

  logger.info("POS order cancelled", {
    integrationId,
    externalOrderId: trimmedExternalId,
    orderId: order.id,
    orderNumber: order.order_number,
  });

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.order_number,
    alreadyCancelled: false,
  };
}
