import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const admin = createAdminClient();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const orderId = pi.metadata.order_id;

      const { data: order } = await admin
        .from("orders")
        .select("id, total, payment_status, stripe_payment_intent_id")
        .eq("stripe_payment_intent_id", pi.id)
        .maybeSingle();

      if (!order && orderId) {
        const { data: byMeta } = await admin
          .from("orders")
          .select("id, total, payment_status, stripe_payment_intent_id")
          .eq("id", orderId)
          .maybeSingle();
        if (byMeta) {
          await verifyAndMarkPaid(admin, byMeta as OrderRow, pi);
        }
        break;
      }

      if (order) {
        await verifyAndMarkPaid(admin, order as OrderRow, pi);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await admin
        .from("orders")
        .update({ payment_status: "failed", status: "rejected" })
        .eq("stripe_payment_intent_id", pi.id);
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;

      if (!piId) break;

      const isFullRefund = charge.amount_refunded === charge.amount;
      await admin
        .from("orders")
        .update({
          payment_status: isFullRefund ? "refunded" : "partial_refund",
        })
        .eq("stripe_payment_intent_id", piId);
      break;
    }

    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      if (account.charges_enabled && account.payouts_enabled) {
        await admin
          .from("organizations")
          .update({ stripe_onboarded: true })
          .eq("stripe_account_id", account.id);
      }
      break;
    }
  }
}

type OrderRow = {
  id: string;
  total: number;
  payment_status: string;
  stripe_payment_intent_id: string | null;
};

async function verifyAndMarkPaid(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderRow,
  pi: Stripe.PaymentIntent
) {
  const expectedCents = Math.round(Number(order.total) * 100);

  if (expectedCents !== pi.amount) {
    console.error("FRAUD ALERT: Amount mismatch", {
      orderId: order.id,
      expected: order.total,
      got: pi.amount / 100,
      paymentIntentId: pi.id,
    });
    return;
  }

  if (order.payment_status === "paid") return;

  await admin
    .from("orders")
    .update({
      payment_status: "paid",
      stripe_payment_intent_id: pi.id,
    })
    .eq("id", order.id);
}
