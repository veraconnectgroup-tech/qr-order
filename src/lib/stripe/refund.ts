import { REFUND_WINDOW_MS } from "@/lib/security/order-limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleOrderTseStorno } from "@/lib/fiscal/sign-transaction";
import { getStripe } from "@/lib/stripe/client";
import { logger } from "@/lib/logger";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import { orgIdForLocation } from "@/lib/webhooks/org-context";

export type OrderForRefund = {
  id: string;
  location_id: string;
  payment_status: string;
  payment_method: string;
  stripe_payment_intent_id: string | null;
  total: number;
  created_at: string;
  tse_signature?: string | null;
};

export type ProcessRefundOptions = {
  amount?: number;
  skipWindowCheck?: boolean;
};

export async function processRefund(
  order: OrderForRefund,
  staffId: string,
  reason: string,
  options: ProcessRefundOptions = {}
): Promise<{ ok: true; refundId: string; amount: number } | { error: string }> {
  if (order.payment_status === "refunded") {
    return { error: "Already refunded" };
  }

  if (
    order.payment_status !== "paid" &&
    order.payment_status !== "partial_refund"
  ) {
    return { error: "Cannot refund unpaid order" };
  }

  if (!order.stripe_payment_intent_id) {
    return { error: "No payment to refund" };
  }

  if (
    order.payment_method !== "online" &&
    order.payment_method !== "pos_online"
  ) {
    return { error: "Refunds are only available for online payments" };
  }

  if (!options.skipWindowCheck) {
    const orderAge = Date.now() - new Date(order.created_at).getTime();
    if (orderAge > REFUND_WINDOW_MS) {
      return { error: "Refund window expired (24h)" };
    }
  }

  const admin = createAdminClient();
  const stripe = getStripe();
  const now = new Date().toISOString();

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", order.location_id)
    .single();

  if (!location) {
    return { error: "Location not found" };
  }

  const { data: org } = await admin
    .from("organizations")
    .select("stripe_account_id")
    .eq("id", (location as { org_id: string }).org_id)
    .single();

  const stripeAccountId = (org as { stripe_account_id: string | null } | null)
    ?.stripe_account_id;

  if (!stripeAccountId) {
    return { error: "Stripe Connect account not configured" };
  }

  const orderTotal = Number(order.total);
  const refundAmount =
    options.amount != null ? Number(options.amount) : orderTotal;

  if (refundAmount <= 0 || refundAmount > orderTotal + 0.01) {
    return { error: "Invalid refund amount" };
  }

  const amountCents = Math.round(refundAmount * 100);
  const orderTotalCents = Math.round(orderTotal * 100);
  const isFullRefund = amountCents >= orderTotalCents;

  const refund = await stripe.refunds.create(
    {
      payment_intent: order.stripe_payment_intent_id,
      amount: amountCents,
      reason: "requested_by_customer",
      reverse_transfer: true,
      refund_application_fee: isFullRefund,
      metadata: { staff_id: staffId, reason, order_id: order.id },
    },
    { stripeAccount: stripeAccountId }
  );

  await admin
    .from("orders")
    .update({
      payment_status: isFullRefund ? "refunded" : "partial_refund",
      refund_id: refund.id,
      refund_reason: reason,
      refunded_by: staffId,
      refunded_at: now,
    } as never)
    .eq("id", order.id);

  await admin.from("audit_log_legacy_pre_g3").insert({
    action: "refund",
    order_id: order.id,
    staff_id: staffId,
    amount: refundAmount,
    reason,
  } as never);

  if (order.tse_signature) {
    scheduleOrderTseStorno(order.id, refundAmount);
  }

  logger.info("Order refunded", {
    orderId: order.id,
    refundId: refund.id,
    amount: refundAmount,
    full: isFullRefund,
  });

  const orgId = await orgIdForLocation(order.location_id);
  if (orgId) {
    dispatchOrgWebhook(orgId, "order.refunded", {
      order_id: order.id,
      amount: refundAmount,
      full: isFullRefund,
    });
  }

  return { ok: true, refundId: refund.id, amount: refundAmount };
}
