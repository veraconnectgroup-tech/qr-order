import type Stripe from "stripe";
import { logger } from "@/lib/logger";
import { enqueue } from "@/lib/queue/client";
import { scheduleOrderTseStorno } from "@/lib/fiscal/sign-transaction";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

function isDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string };
  return (
    record.code === "23505" ||
    /duplicate key/i.test(record.message ?? "")
  );
}

async function deleteWebhookEvent(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string
) {
  const { error } = await admin.from("webhook_events").delete().eq("id", eventId);

  if (error) {
    logger.warn("Failed to delete webhook event after processing error", {
      eventId,
      error: error.message,
    });
  }
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("webhook_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (existing) {
    logger.info("Duplicate webhook skipped", {
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }

  try {
    const { error: insertError } = await admin.from("webhook_events").insert({
      id: event.id,
      event_type: event.type,
      payload: event as unknown as Json,
    });

    if (insertError) {
      if (isDuplicateError(insertError)) {
        logger.info("Duplicate webhook skipped", {
          eventId: event.id,
          eventType: event.type,
        });
        return;
      }
      throw insertError;
    }

    await processStripeWebhookEvent(admin, event);
  } catch (err) {
    if (!isDuplicateError(err)) {
      await deleteWebhookEvent(admin, event.id);
    }
    throw err;
  }
}

async function processStripeWebhookEvent(
  admin: ReturnType<typeof createAdminClient>,
  event: Stripe.Event
) {
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

      const { data: order } = await admin
        .from("orders")
        .select(
          "id, total, payment_status, refund_id, refund_reason, refunded_by, refunded_at, tse_signature"
        )
        .eq("stripe_payment_intent_id", piId)
        .maybeSingle();

      if (!order) break;

      const orderRow = order as {
        id: string;
        total: number;
        payment_status: string;
        refund_id: string | null;
        refund_reason: string | null;
        refunded_by: string | null;
        refunded_at: string | null;
        tse_signature: string | null;
      };

      const isFullRefund = charge.amount_refunded >= charge.amount;
      const paymentStatus = isFullRefund ? "refunded" : "partial_refund";

      const refunds =
        typeof charge.refunds === "object" && charge.refunds?.data
          ? charge.refunds.data
          : [];
      const latestRefund = refunds[refunds.length - 1];
      const refundId = latestRefund?.id ?? null;

      const updates: Record<string, unknown> = {
        payment_status: paymentStatus,
      };

      if (refundId && !orderRow.refund_id) {
        updates.refund_id = refundId;
      }
      if (!orderRow.refunded_at) {
        updates.refunded_at = new Date().toISOString();
      }

      await admin.from("orders").update(updates as never).eq("id", orderRow.id);

      if (
        orderRow.tse_signature &&
        orderRow.payment_status !== "refunded" &&
        orderRow.payment_status !== "partial_refund"
      ) {
        const refundAmount = charge.amount_refunded / 100;
        scheduleOrderTseStorno(orderRow.id, refundAmount);
      }

      logger.info("Charge refunded (webhook sync)", {
        orderId: orderRow.id,
        paymentIntentId: piId,
        full: isFullRefund,
        fromDashboard: Boolean(orderRow.refunded_by),
      });
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

    void enqueue("/api/jobs/send-receipt", { orderId: order.id }).catch((err) =>
      logger.error("Receipt enqueue failed", {
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

  void enqueue("/api/jobs/send-receipt", { orderId: order.id }).catch((err) =>
    logger.error("Receipt enqueue failed", {
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    })
  );
}
