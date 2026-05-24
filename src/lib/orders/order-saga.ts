import type Stripe from "stripe";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import { resolveFiscalBehavior } from "@/lib/fulfillment/resolve-fiscal-behavior";
import { dispatchOrgWebhook } from "@/lib/webhooks/dispatch";
import { enqueueOutboxEvents } from "@/lib/outbox/enqueue-events";
import { loadOrderOutboxContext } from "@/lib/outbox/load-outbox-context";
import type { OutboxInsert } from "@/lib/outbox/types";
import { logger } from "@/lib/logger";
import { traceMetadata } from "@/lib/resilience/trace";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";

export type SagaResult = {
  success: boolean;
  completedSteps: string[];
  failedStep?: string;
  deferredSteps: string[];
  skipped?: boolean;
};

export type OrderSagaPaymentInput = {
  paymentIntentId?: string;
  amountCents: number;
  tipAmount?: number;
  guestEmail?: string | null;
};

type OrderRow = {
  id: string;
  total: number;
  payment_status: string;
  payment_method: string;
  stripe_payment_intent_id: string | null;
  status: string;
  location_id: string;
  order_number: number;
  tip_amount: number | null;
  table_id: string | null;
};

const CRITICAL_STEPS = ["validate_order", "create_payment", "confirm_order"] as const;
const DEFERRABLE_STEPS = ["tse_sign", "print", "send_receipt"] as const;

function logStep(
  traceId: string,
  step: string,
  level: "info" | "warn" | "error",
  message: string,
  metadata?: Record<string, unknown>
) {
  const payload = traceMetadata({ orderSagaStep: step, ...metadata });
  logger[level](message, payload);
  void traceId;
}

function buildPaymentCompletionEvents(
  ctx: Awaited<ReturnType<typeof loadOrderOutboxContext>>
): OutboxInsert[] {
  const events: OutboxInsert[] = [];
  const guestEmail = ctx.guestEmail ?? null;

  if (resolveFiscalBehavior(ctx.posIntegration) === "standalone") {
    events.push({
      aggregate_id: ctx.orderId,
      domain: "fiscal",
      event_type: "fiscal.tse_sign",
      payload: { orderId: ctx.orderId, guestEmail },
    });
  } else if (guestEmail) {
    events.push({
      aggregate_id: ctx.orderId,
      domain: "fiscal",
      event_type: "fiscal.send_receipt",
      payload: { orderId: ctx.orderId, guestEmail },
    });
  }

  for (const printer of ctx.cloudPrinters) {
    if (!printer.autoPrint) continue;
    events.push({
      aggregate_id: ctx.orderId,
      domain: "fulfillment",
      event_type: "fulfill.cloud_print",
      payload: {
        orderId: ctx.orderId,
        locationId: ctx.locationId,
        orgId: ctx.orgId,
        orderNumber: ctx.orderNumber,
        tableName: ctx.tableName,
        total: ctx.total,
        printerId: printer.id,
        provider: printer.provider,
      },
    });
  }

  if (
    resolveFiscalBehavior(ctx.posIntegration) !== "standalone" ||
    !events.some((event) => event.event_type === "fiscal.tse_sign")
  ) {
    if (
      guestEmail &&
      !events.some((event) => event.event_type === "fiscal.send_receipt")
    ) {
      events.push({
        aggregate_id: ctx.orderId,
        domain: "fiscal",
        event_type: "fiscal.send_receipt",
        payload: { orderId: ctx.orderId, guestEmail },
      });
    }
  }

  return events;
}

async function enqueueOrDlq(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  step: string,
  event: OutboxInsert,
  traceId: string,
  orderId: string
): Promise<"enqueued" | "dlq"> {
  try {
    await enqueueOutboxEvents(admin, [event]);
    return "enqueued";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logStep(traceId, step, "error", "Deferrable step enqueue failed — moving to DLQ", {
      orderId,
      eventType: event.event_type,
      error: message,
    });

    await admin.from("dead_letter_queue" as never).insert({
      org_id: orgId,
      job_type: event.event_type,
      payload: {
        outboxPayload: event.payload,
        aggregateId: event.aggregate_id,
        domain: event.domain,
        sagaStep: step,
      },
      error_message: message.slice(0, 2000),
      attempts: 0,
      max_attempts: 5,
    } as never);

    return "dlq";
  }
}

async function voidPayment(paymentIntentId: string, stripeAccountId?: string) {
  const stripe = getStripe();
  const connectOpts = stripeAccountId
    ? { stripeAccount: stripeAccountId }
    : undefined;

  try {
    const pi = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      {},
      connectOpts
    );

    if (pi.status === "succeeded") {
      await stripe.refunds.create(
        { payment_intent: paymentIntentId },
        connectOpts
      );
      return;
    }

    if (pi.status !== "canceled") {
      await stripe.paymentIntents.cancel(paymentIntentId, {}, connectOpts);
    }
  } catch (error) {
    logger.error("Order saga payment void failed", traceMetadata({
      paymentIntentId,
      error: error instanceof Error ? error.message : String(error),
    }));
  }
}

async function loadOrderContext(
  admin: ReturnType<typeof createAdminClient>,
  orderId: string
) {
  const { data: order } = await admin
    .from("orders")
    .select(
      "id, total, payment_status, payment_method, stripe_payment_intent_id, status, location_id, order_number, tip_amount, table_id"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (!order) return null;

  const orderRow = order as OrderRow;

  const { data: location } = await admin
    .from("locations")
    .select("org_id, name")
    .eq("id", orderRow.location_id)
    .single();

  if (!location) return null;

  const loc = location as { org_id: string; name: string };

  let tableName = loc.name;
  if (orderRow.table_id) {
    const { data: table } = await admin
      .from("tables")
      .select("name")
      .eq("id", orderRow.table_id)
      .maybeSingle();
    if (table) {
      tableName = (table as { name: string }).name;
    }
  }

  return {
    order: orderRow,
    orgId: loc.org_id,
    tableName,
  };
}

export async function executeOrderSaga(
  orderId: string,
  traceId: string,
  payment: OrderSagaPaymentInput
): Promise<SagaResult> {
  const admin = createAdminClient();
  const completedSteps: string[] = [];
  const deferredSteps: string[] = [];

  let currentStep = "validate_order";
  let previousPaymentStatus: string | null = null;
  let previousPaymentIntentId: string | null = null;
  let stripeAccountId: string | null = null;
  let paymentIntentMutated = false;

  try {
    logStep(traceId, "validate_order", "info", "Order saga: validate_order", {
      orderId,
    });

    const loaded = await loadOrderContext(admin, orderId);
    if (!loaded) {
      return {
        success: false,
        completedSteps,
        failedStep: "validate_order",
        deferredSteps,
      };
    }

    const { order, orgId, tableName } = loaded;

    if (isPaidPaymentStatus(order.payment_status)) {
      logStep(traceId, "validate_order", "info", "Order saga: already paid", {
        orderId,
      });
      return {
        success: true,
        completedSteps: [...CRITICAL_STEPS, ...DEFERRABLE_STEPS],
        deferredSteps: [],
        skipped: true,
      };
    }

    if (order.status === "rejected" || order.status === "cancelled") {
      logStep(traceId, "validate_order", "error", "Order saga: order closed", {
        orderId,
        status: order.status,
      });
      return {
        success: false,
        completedSteps,
        failedStep: "validate_order",
        deferredSteps,
      };
    }

    const tipAmount =
      payment.tipAmount ?? Number(order.tip_amount ?? 0);
    const expectedCents =
      Math.round(Number(order.total) * 100) + Math.round(tipAmount * 100);

    if (expectedCents !== payment.amountCents) {
      logStep(traceId, "validate_order", "error", "Order saga: amount mismatch", {
        orderId,
        expectedCents,
        gotCents: payment.amountCents,
      });
      return {
        success: false,
        completedSteps,
        failedStep: "validate_order",
        deferredSteps,
      };
    }

    completedSteps.push("validate_order");

    currentStep = "create_payment";
    logStep(traceId, "create_payment", "info", "Order saga: create_payment", {
      orderId,
    });

    previousPaymentStatus = order.payment_status;
    previousPaymentIntentId = order.stripe_payment_intent_id;

    if (payment.paymentIntentId) {
      const { data: org } = await admin
        .from("organizations")
        .select("stripe_account_id")
        .eq("id", orgId)
        .single();
      stripeAccountId =
        (org as { stripe_account_id: string | null } | null)
          ?.stripe_account_id ?? null;

      if (order.stripe_payment_intent_id !== payment.paymentIntentId) {
        const { error } = await admin
          .from("orders")
          .update({ stripe_payment_intent_id: payment.paymentIntentId })
          .eq("id", orderId);

        if (error) {
          throw new Error(error.message);
        }
        paymentIntentMutated = true;
      }
    }

    completedSteps.push("create_payment");

    currentStep = "confirm_order";
    logStep(traceId, "confirm_order", "info", "Order saga: confirm_order", {
      orderId,
    });

    const { error: confirmError } = await admin
      .from("orders")
      .update({ payment_status: "paid" })
      .eq("id", orderId);

    if (confirmError) {
      throw new Error(confirmError.message);
    }

    completedSteps.push("confirm_order");

    dispatchOrgWebhook(orgId, "order.paid", {
      order_id: orderId,
      payment_intent_id: payment.paymentIntentId ?? null,
    });

    const outboxCtx = await loadOrderOutboxContext(admin, {
      orderId,
      locationId: order.location_id,
      orgId,
      orderNumber: order.order_number,
      tableName,
      total: Number(order.total),
      paymentStatus: "paid",
      guestEmail: payment.guestEmail ?? null,
    });

    const deferEvents = buildPaymentCompletionEvents(outboxCtx);
    const stepByEvent: Record<string, string> = {
      "fiscal.tse_sign": "tse_sign",
      "fulfill.cloud_print": "print",
      "fiscal.send_receipt": "send_receipt",
    };

    for (const event of deferEvents) {
      const step = stepByEvent[event.event_type] ?? event.event_type;
      logStep(traceId, step, "info", "Order saga: enqueue deferrable step", {
        orderId,
        eventType: event.event_type,
      });

      const outcome = await enqueueOrDlq(
        admin,
        orgId,
        step,
        event,
        traceId,
        orderId
      );
      deferredSteps.push(step);
      if (outcome === "dlq") {
        logStep(traceId, step, "warn", "Order saga: step deferred via DLQ", {
          orderId,
        });
      }
    }

    logStep(traceId, "complete", "info", "Order saga completed", {
      orderId,
      completedSteps,
      deferredSteps,
    });

    return {
      success: true,
      completedSteps,
      deferredSteps,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedStep = currentStep;

    logStep(traceId, failedStep, "error", "Order saga critical step failed", {
      orderId,
      error: message,
      completedSteps,
    });

    if (completedSteps.includes("confirm_order")) {
      await admin
        .from("orders")
        .update({
          payment_status: (previousPaymentStatus ?? "pending") as never,
        })
        .eq("id", orderId);
    } else if (paymentIntentMutated) {
      await admin
        .from("orders")
        .update({
          stripe_payment_intent_id: previousPaymentIntentId,
          payment_status: (previousPaymentStatus ?? "pending") as never,
        } as never)
        .eq("id", orderId);
    }

    if (
      payment.paymentIntentId &&
      (completedSteps.includes("create_payment") ||
        completedSteps.includes("confirm_order"))
    ) {
      await voidPayment(
        payment.paymentIntentId,
        stripeAccountId ?? undefined
      );
    }

    return {
      success: false,
      completedSteps,
      failedStep,
      deferredSteps,
    };
  }
}

export async function executeOrderSagaFromPaymentIntent(
  orderId: string,
  traceId: string,
  pi: Stripe.PaymentIntent
): Promise<SagaResult> {
  const tipAmount = pi.metadata.tip_amount
    ? Number(pi.metadata.tip_amount)
    : undefined;

  return executeOrderSaga(orderId, traceId, {
    paymentIntentId: pi.id,
    amountCents: pi.amount,
    tipAmount,
    guestEmail:
      typeof pi.metadata.guest_email === "string"
        ? pi.metadata.guest_email
        : null,
  });
}
