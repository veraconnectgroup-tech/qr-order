import { REFUND_WINDOW_MS } from "@/lib/security/order-limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

type OrderForRefund = {
  id: string;
  location_id: string;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  total: number;
  created_at: string;
};

export async function processRefund(
  order: OrderForRefund,
  staffId: string,
  reason: string
): Promise<{ ok: true } | { error: string }> {
  if (
    order.payment_status === "refunded" ||
    order.payment_status === "partial_refund"
  ) {
    return { error: "Already refunded" };
  }

  if (order.payment_status !== "paid") {
    return { error: "Cannot refund unpaid order" };
  }

  if (!order.stripe_payment_intent_id) {
    return { error: "No payment to refund" };
  }

  const orderAge = Date.now() - new Date(order.created_at).getTime();
  if (orderAge > REFUND_WINDOW_MS) {
    return { error: "Refund window expired (24h)" };
  }

  const admin = createAdminClient();
  const stripe = getStripe();
  const now = new Date().toISOString();

  const refund = await stripe.refunds.create({
    payment_intent: order.stripe_payment_intent_id,
    reason: "requested_by_customer",
    reverse_transfer: true,
    refund_application_fee: true,
    metadata: { staff_id: staffId, reason },
  });

  await admin
    .from("orders")
    .update({
      payment_status: "refunded",
      refund_id: refund.id,
      refund_reason: reason,
      refunded_by: staffId,
      refunded_at: now,
    } as never)
    .eq("id", order.id);

  await admin.from("audit_log").insert({
    action: "refund",
    order_id: order.id,
    staff_id: staffId,
    amount: order.total,
    reason,
  } as never);

  return { ok: true };
}
