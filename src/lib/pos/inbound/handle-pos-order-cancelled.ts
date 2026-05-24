import { auditLog } from "@/lib/audit/log";
import { signOrderStornoById } from "@/lib/fiscal/sign-transaction";
import { logger } from "@/lib/logger";
import { buildPosOrderIdempotencyKey } from "@/lib/pos/inbound/create-pos-order";
import type { InboundWebhookResult } from "@/lib/pos/inbound/types";
import type { PosProvider } from "@/lib/pos/pos-actions";
import { processRefund, type OrderForRefund } from "@/lib/stripe/refund";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import type { Json } from "@/types/database";

export type PosIntegrationContext = {
  id: string;
  location_id: string;
  provider: PosProvider;
  config: Json;
};

const IDEMPOTENT_CANCEL_STATUSES = new Set(["cancelled", "rejected"]);

type OrderRow = {
  id: string;
  order_number: number;
  status: string;
  payment_status: string;
  payment_method: string;
  stripe_payment_intent_id: string | null;
  total: number;
  created_at: string;
  tse_signature: string | null;
  location_id: string;
};

export async function handlePosOrderCancelled(
  admin: ReturnType<typeof createAdminClient>,
  integration: PosIntegrationContext,
  externalOrderId: string
): Promise<InboundWebhookResult> {
  const trimmedExternalId = externalOrderId.trim();
  if (!trimmedExternalId) {
    return { ok: false, status: 422, message: "Missing externalOrderId" };
  }

  const idempotencyKey = buildPosOrderIdempotencyKey(
    integration.provider,
    trimmedExternalId
  );

  const { data: orderData } = await admin
    .from("orders")
    .select(
      "id, order_number, status, payment_status, payment_method, stripe_payment_intent_id, total, created_at, tse_signature, location_id"
    )
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (!orderData) {
    return {
      ok: true,
      status: 200,
      body: {
        message: "order_not_found",
        externalOrderId: trimmedExternalId,
      },
    };
  }

  const order = orderData as OrderRow;

  if (IDEMPOTENT_CANCEL_STATUSES.has(order.status)) {
    return {
      ok: true,
      status: 200,
      body: {
        message: "cancel_already_applied",
        orderId: order.id,
        orderNumber: order.order_number,
        externalOrderId: trimmedExternalId,
      },
    };
  }

  let refundedViaStripe = false;

  if (
    (order.payment_status === "paid" || order.payment_status === "pos_online") &&
    order.stripe_payment_intent_id
  ) {
    const refundResult = await processRefund(
      order as OrderForRefund,
      `pos:${integration.id}`,
      "Cancelled by POS",
      { skipWindowCheck: true }
    );

    if ("error" in refundResult) {
      logger.warn("POS cancel refund failed", {
        orderId: order.id,
        integrationId: integration.id,
        externalOrderId: trimmedExternalId,
        error: refundResult.error,
      });
      return {
        ok: false,
        status: 409,
        message: refundResult.error,
      };
    }

    refundedViaStripe = true;
  }

  const { error: updateError } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      rejection_reason: "Cancelled by POS",
    })
    .eq("id", order.id);

  if (updateError) {
    logger.error("POS order cancel update failed", {
      orderId: order.id,
      integrationId: integration.id,
      error: updateError.message,
    });
    return { ok: false, status: 500, message: "Order could not be cancelled" };
  }

  if (order.tse_signature && !refundedViaStripe) {
    try {
      await signOrderStornoById(order.id);
    } catch (error) {
      logger.error("POS cancel TSE storno failed", {
        orderId: order.id,
        integrationId: integration.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", order.location_id)
    .maybeSingle();

  const orgId = (location as { org_id: string } | null)?.org_id;

  if (orgId) {
    await auditLog({
      orgId,
      action: "update",
      entityType: "order",
      entityId: order.id,
      oldValue: {
        status: order.status,
        payment_status: order.payment_status,
      },
      newValue: {
        status: "cancelled",
        source: "pos_inbound",
        external_order_id: trimmedExternalId,
      },
    });

    dispatchOrgWebhook(orgId, "order.cancelled", {
      order_id: order.id,
      external_order_id: trimmedExternalId,
      status: "cancelled",
    });
  }

  logger.info("POS order cancelled", {
    orderId: order.id,
    orderNumber: order.order_number,
    integrationId: integration.id,
    externalOrderId: trimmedExternalId,
    refundedViaStripe,
  });

  return {
    ok: true,
    status: 200,
    body: {
      message: "order_cancelled",
      orderId: order.id,
      orderNumber: order.order_number,
      externalOrderId: trimmedExternalId,
      refunded: refundedViaStripe,
    },
  };
}
