import type Stripe from "stripe";
import { maybeSendOrderReceipt } from "@/lib/email/send-order-receipt";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const admin = createAdminClient();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;

      if (pi.metadata.order_ids) {
        await verifyAndMarkSessionPaid(admin, pi);
        break;
      }

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
      logger.error("Payment failed", {
        paymentIntentId: pi.id,
        orderId: pi.metadata.order_id,
        orderIds: pi.metadata.order_ids,
      });
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

async function verifyAndMarkSessionPaid(
  admin: ReturnType<typeof createAdminClient>,
  pi: Stripe.PaymentIntent
) {
  const orderIds = pi.metadata.order_ids?.split(",").filter(Boolean) ?? [];
  if (orderIds.length === 0) return;

  const { data: orders } = await admin
    .from("orders")
    .select("id, total, payment_status")
    .in("id", orderIds);

  const rows = (orders as OrderRow[]) ?? [];
  if (rows.length === 0) return;

  const expectedCents = rows.reduce(
    (sum, o) => sum + Math.round(Number(o.total) * 100),
    0
  );

  if (expectedCents !== pi.amount) {
    logger.error("FRAUD ALERT: Session amount mismatch", {
      orderIds,
      expected: expectedCents / 100,
      got: pi.amount / 100,
      paymentIntentId: pi.id,
    });
    return;
  }

  for (const order of rows) {
    if (order.payment_status === "paid") continue;
    await admin
      .from("orders")
      .update({
        payment_status: "paid",
        stripe_payment_intent_id: pi.id,
      })
      .eq("id", order.id);

    logger.info("Payment succeeded", {
      orderId: order.id,
      paymentIntentId: pi.id,
      sessionCheckout: true,
    });

    maybeSendOrderReceipt(order.id).catch((err) =>
      logger.error("Receipt email failed", {
        orderId: order.id,
        error: err instanceof Error ? err.message : String(err),
      })
    );
  }
}

async function verifyAndMarkPaid(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderRow,
  pi: Stripe.PaymentIntent
) {
  const expectedCents = Math.round(Number(order.total) * 100);

  if (expectedCents !== pi.amount) {
    logger.error("FRAUD ALERT: Amount mismatch", {
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

  logger.info("Payment succeeded", {
    orderId: order.id,
    paymentIntentId: pi.id,
  });

  maybeSendOrderReceipt(order.id).catch((err) =>
    logger.error("Receipt email failed", {
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    })
  );
}
