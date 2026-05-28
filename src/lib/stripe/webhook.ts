import type Stripe from "stripe";
import { applyCreditPurchase } from "@/lib/denis/commercial/apply-credit-purchase";
import { logger } from "@/lib/logger";
import { executeOrderSagaFromPaymentIntent } from "@/lib/orders/order-saga";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { scheduleOrderTseStorno } from "@/lib/fiscal/sign-transaction";
import { getCurrentTraceId } from "@/lib/resilience/trace";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

const PROCESSING_STALE_MS = 30_000;

type WebhookEventRow = {
  id: string;
  status: string;
  processed_at: string;
};

function isDuplicateError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: string; message?: string };
  return (
    record.code === "23505" ||
    /duplicate key/i.test(record.message ?? "")
  );
}

function isProcessingStale(processedAt: string) {
  return Date.now() - new Date(processedAt).getTime() >= PROCESSING_STALE_MS;
}

async function markWebhookStatus(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  status: "processing" | "completed" | "failed"
) {
  const { error } = await admin
    .from("webhook_events")
    .update({ status, processed_at: new Date().toISOString() })
    .eq("id", eventId);

  if (error) {
    logger.warn("Failed to update webhook event status", {
      eventId,
      status,
      error: error.message,
    });
  }
}

function shouldSkipExistingWebhook(existing: WebhookEventRow, event: Stripe.Event) {
  if (existing.status === "completed") {
    logger.info("Duplicate webhook skipped", {
      eventId: event.id,
      eventType: event.type,
    });
    return true;
  }

  if (existing.status === "processing" && !isProcessingStale(existing.processed_at)) {
    logger.info("Webhook still processing, skipped", {
      eventId: event.id,
      eventType: event.type,
    });
    return true;
  }

  if (existing.status === "processing") {
    logger.warn("Stale processing webhook, retrying", {
      eventId: event.id,
      eventType: event.type,
    });
  }

  return false;
}

export async function handleStripeWebhookEvent(event: Stripe.Event) {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("webhook_events")
    .select("id, status, processed_at")
    .eq("id", event.id)
    .maybeSingle();

  if (existing && shouldSkipExistingWebhook(existing as WebhookEventRow, event)) {
    return;
  }

  try {
    if (existing) {
      await markWebhookStatus(admin, event.id, "processing");
    } else {
      const { error: insertError } = await admin.from("webhook_events").insert({
        id: event.id,
        event_type: event.type,
        payload: event as unknown as Json,
        status: "processing",
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
    }

    await processStripeWebhookEvent(admin, event);
    await markWebhookStatus(admin, event.id, "completed");
  } catch (err) {
    if (!isDuplicateError(err)) {
      await markWebhookStatus(admin, event.id, "failed");
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
      const isTerminalPayment =
        pi.metadata.terminal === "true" ||
        pi.payment_method_types?.includes("card_present");

      if (isTerminalPayment) {
        logger.info("Stripe Terminal payment succeeded", {
          paymentIntentId: pi.id,
          orderId: pi.metadata.order_id ?? null,
          sessionId: pi.metadata.session_id ?? null,
          amount: pi.amount,
        });
      }

      if (pi.metadata.split_payment_id) {
        await verifyAndMarkSplitPaid(admin, pi);
        break;
      }

      if (pi.metadata.order_ids) {
        await verifyAndMarkSessionPaid(admin, pi);
        break;
      }

      const orderId = pi.metadata.order_id;

      const { data: order } = await admin
        .from("orders")
        .select("id, total, payment_status, stripe_payment_intent_id, tip_amount")
        .eq("stripe_payment_intent_id", pi.id)
        .maybeSingle();

      if (!order && orderId) {
        const { data: byMeta } = await admin
          .from("orders")
          .select("id, total, payment_status, stripe_payment_intent_id, tip_amount")
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
        splitPaymentId: pi.metadata.split_payment_id,
      });
      if (pi.metadata.split_payment_id) {
        await admin
          .from("split_payments")
          .update({ payment_status: "failed" })
          .eq("id", pi.metadata.split_payment_id);
        break;
      }
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

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const packageId = session.metadata?.packageId;
      const orgId = session.metadata?.orgId;
      const creditsRaw = session.metadata?.credits;

      if (!packageId || !orgId || !creditsRaw) break;
      if (session.payment_status !== "paid") break;

      const credits = Number.parseInt(creditsRaw, 10);
      if (!Number.isFinite(credits) || credits <= 0) {
        logger.error("AI credits purchase invalid amount", {
          orgId,
          packageId,
          creditsRaw,
        });
        break;
      }

      const purchase = await applyCreditPurchase(admin, {
        orgId,
        amount: credits,
        source: "stripe",
        referenceId: session.id,
        packageId,
      });

      if (!purchase.ok) {
        logger.error("AI credits purchase failed", {
          orgId,
          packageId,
          code: purchase.code,
        });
        throw new Error(`AI credits purchase failed: ${purchase.code}`);
      }

      logger.info("AI credits purchased", {
        orgId,
        packageId,
        credits,
        balance: purchase.balanceAfter,
        checkoutSessionId: session.id,
      });
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

  const sessionId = pi.metadata.session_id ?? null;

  const { data: orders } = await admin
    .from("orders")
    .select("id, total, payment_status, tip_amount, location_id, order_source")
    .in("id", orderIds);

  const rows = (orders as (OrderRow & {
    tip_amount?: number;
    location_id: string;
    order_source: string;
  })[]) ?? [];
  if (rows.length === 0) return;

  const tipFromMeta = pi.metadata.tip_amount
    ? Number(pi.metadata.tip_amount)
    : 0;
  const tipFromDb = rows.reduce((sum, o) => sum + Number(o.tip_amount ?? 0), 0);
  const tipAmount = tipFromMeta > 0 ? tipFromMeta : tipFromDb;

  const expectedCents =
    rows.reduce((sum, o) => sum + Math.round(Number(o.total) * 100), 0) +
    Math.round(tipAmount * 100);

  if (expectedCents !== pi.amount) {
    logger.error("FRAUD ALERT: Session amount mismatch", {
      orderIds,
      expected: expectedCents / 100,
      got: pi.amount / 100,
      paymentIntentId: pi.id,
    });
    return;
  }

  const paidOrderIds: string[] = [];
  let allSucceeded = true;

  for (const order of rows) {
    if (isPaidPaymentStatus(order.payment_status)) {
      paidOrderIds.push(order.id);
      continue;
    }

    const traceId = getCurrentTraceId() ?? crypto.randomUUID();
    const result = await executeOrderSagaFromPaymentIntent(
      order.id,
      traceId,
      pi
    );

    if (!result.success) {
      allSucceeded = false;
      logger.error("Order saga failed for session checkout", {
        orderId: order.id,
        paymentIntentId: pi.id,
        failedStep: result.failedStep,
      });
      continue;
    }

    paidOrderIds.push(order.id);

    logger.info("Payment succeeded", {
      orderId: order.id,
      paymentIntentId: pi.id,
      sessionCheckout: true,
      saga: result,
    });
  }

  if (!allSucceeded || paidOrderIds.length === 0) return;

  const locationId = rows[0]?.location_id;
  if (!locationId || !sessionId) return;

  const { data: location } = await admin
    .from("locations")
    .select("org_id")
    .eq("id", locationId)
    .single();

  const orgId = (location as { org_id: string } | null)?.org_id;
  if (!orgId) return;

  const { markSessionOrdersPaidOnline } = await import(
    "@/lib/orders/mark-session-paid-online"
  );

  await markSessionOrdersPaidOnline(admin, {
    sessionId,
    locationId,
    orgId,
    paymentIntentId: pi.id,
    amountCents: pi.amount,
    orderIds: paidOrderIds,
  });
}

async function verifyAndMarkPaid(
  admin: ReturnType<typeof createAdminClient>,
  order: OrderRow & { tip_amount?: number },
  pi: Stripe.PaymentIntent
) {
  const tipAmount = pi.metadata.tip_amount
    ? Number(pi.metadata.tip_amount)
    : Number(order.tip_amount ?? 0);
  const expectedCents =
    Math.round(Number(order.total) * 100) + Math.round(tipAmount * 100);

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

  const traceId = getCurrentTraceId() ?? crypto.randomUUID();
  const result = await executeOrderSagaFromPaymentIntent(order.id, traceId, pi);

  if (!result.success) {
    logger.error("Order saga failed", {
      orderId: order.id,
      paymentIntentId: pi.id,
      failedStep: result.failedStep,
    });
    return;
  }

  logger.info("Payment succeeded", {
    orderId: order.id,
    paymentIntentId: pi.id,
    saga: result,
  });
}

async function verifyAndMarkSplitPaid(
  admin: ReturnType<typeof createAdminClient>,
  pi: Stripe.PaymentIntent
) {
  const splitId = pi.metadata.split_payment_id;
  if (!splitId) return;

  const { data: split } = await admin
    .from("split_payments")
    .select("id, order_id, amount, tip_amount, payment_status")
    .eq("id", splitId)
    .maybeSingle();

  if (!split) return;

  const row = split as {
    id: string;
    order_id: string;
    amount: number;
    tip_amount: number;
    payment_status: string;
  };

  if (row.payment_status === "paid") return;

  const expectedCents =
    Math.round(Number(row.amount) * 100) +
    Math.round(Number(row.tip_amount ?? 0) * 100);

  if (expectedCents !== pi.amount) {
    logger.error("FRAUD ALERT: Split amount mismatch", {
      splitId,
      orderId: row.order_id,
      expected: expectedCents / 100,
      got: pi.amount / 100,
      paymentIntentId: pi.id,
    });
    return;
  }

  const sessionId = pi.metadata.session_id ?? null;

  await admin
    .from("split_payments")
    .update({
      payment_status: "paid",
      paid_by_session_id: sessionId,
    })
    .eq("id", splitId);

  const { data: allSplits } = await admin
    .from("split_payments")
    .select("payment_status")
    .eq("order_id", row.order_id);

  const splits = (allSplits as Array<{ payment_status: string }>) ?? [];
  const allPaid =
    splits.length > 0 && splits.every((s) => s.payment_status === "paid");

  if (allPaid) {
    const traceId = getCurrentTraceId() ?? crypto.randomUUID();
    const result = await executeOrderSagaFromPaymentIntent(
      row.order_id,
      traceId,
      pi
    );

    if (!result.success) {
      logger.error("Order saga failed for split checkout", {
        orderId: row.order_id,
        paymentIntentId: pi.id,
        failedStep: result.failedStep,
      });
    }
  }

  logger.info("Split payment succeeded", {
    splitId,
    orderId: row.order_id,
    paymentIntentId: pi.id,
    orderFullyPaid: allPaid,
  });
}
