import { resolveFiscalBehavior } from "@/lib/fulfillment/resolve-fiscal-behavior";
import { resolvePosPaymentState } from "@/lib/outbox/resolve-pos-payment-state";
import type {
  OrderOutboxContext,
  OrderSideEffectPhase,
  OutboxInsert,
} from "@/lib/outbox/types";

function basePayload(ctx: OrderOutboxContext) {
  return {
    orderId: ctx.orderId,
    locationId: ctx.locationId,
    orgId: ctx.orgId,
    orderNumber: ctx.orderNumber,
    tableName: ctx.tableName,
    total: ctx.total,
  };
}

export function buildOutboxEvents(
  ctx: OrderOutboxContext,
  phase: OrderSideEffectPhase
): OutboxInsert[] {
  if (phase === "approval_requested") {
    return [];
  }

  const events: OutboxInsert[] = [
    {
      aggregate_id: ctx.orderId,
      domain: "fulfillment",
      event_type: "fulfill.notify_staff",
      payload: basePayload(ctx),
    },
  ];

  if (ctx.posIntegration?.status === "connected") {
    events.push({
      aggregate_id: ctx.orderId,
      domain: "fulfillment",
      event_type: "fulfill.push_pos",
      payload: {
        ...basePayload(ctx),
        paymentState: resolvePosPaymentState(ctx.paymentStatus),
        provider: ctx.posIntegration.provider,
        posIntegrationId: ctx.posIntegration.id,
      },
    });
  }

  for (const printer of ctx.cloudPrinters) {
    if (!printer.autoPrint) continue;
    events.push({
      aggregate_id: ctx.orderId,
      domain: "fulfillment",
      event_type: "fulfill.cloud_print",
      payload: {
        ...basePayload(ctx),
        printerId: printer.id,
        provider: printer.provider,
      },
    });
  }

  if (resolveFiscalBehavior(ctx.posIntegration) === "standalone") {
    events.push({
      aggregate_id: ctx.orderId,
      domain: "fiscal",
      event_type: "fiscal.tse_sign",
      payload: { orderId: ctx.orderId },
    });

    if (ctx.guestEmail) {
      events.push({
        aggregate_id: ctx.orderId,
        domain: "fiscal",
        event_type: "fiscal.send_receipt",
        payload: {
          orderId: ctx.orderId,
          guestEmail: ctx.guestEmail,
        },
      });
    }
  }

  for (const webhook of ctx.activeWebhooks) {
    events.push({
      aggregate_id: ctx.orderId,
      domain: "integration",
      event_type: "integration.webhook",
      payload: {
        ...basePayload(ctx),
        webhookConfigId: webhook.id,
        webhookEvent: "order.created",
        orderSource: ctx.orderSource ?? "qr",
      },
    });
  }

  return events;
}

export function orderEventTypeForPhase(
  phase: OrderSideEffectPhase
): "order.created" | "order.approval_requested" | "order.approved" {
  if (phase === "approval_requested") return "order.approval_requested";
  if (phase === "approved") return "order.approved";
  return "order.created";
}

export function orderEventIdempotencyKey(phase: OrderSideEffectPhase): string {
  if (phase === "approval_requested") return "order.approval_requested";
  if (phase === "approved") return "order.approved";
  return "order.created";
}
