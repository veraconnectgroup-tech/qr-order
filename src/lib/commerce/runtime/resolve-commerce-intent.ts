import type { CommerceCommandType, CommerceEventType } from "@/lib/commerce/event-types";
import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import { submitFeedbackCommandMeta } from "@/lib/commerce/capabilities/feedback-v2/submit-feedback";
import { recordGoogleReviewClickCommandMeta } from "@/lib/commerce/capabilities/reviews/record-google-review-click";
import { recordTipSelectionCommandMeta } from "@/lib/commerce/capabilities/tips/record-tip-selection";
import type { CommerceTrigger } from "@/lib/commerce/runtime/types";

export type CommerceIntent =
  | {
      type: "emit";
      commandType: CommerceCommandType;
      eventType: CommerceEventType;
      payload: Record<string, unknown>;
    }
  | { type: "none"; reason: string };

export type CommerceIntentContext = {
  paymentStatus: string;
  paymentMethod: string;
  amountCents: number;
  orderId: string;
};

export function resolveCommerceIntent(
  trigger: CommerceTrigger,
  ctx: CommerceIntentContext
): CommerceIntent {
  if (trigger.kind === "payment_settled") {
    if (ctx.paymentStatus !== "paid") {
      return { type: "none", reason: "not_paid" };
    }

    return {
      type: "emit",
      commandType: COMMERCE_COMMAND_TYPES.recordPaymentSettled,
      eventType: COMMERCE_EVENT_TYPES.paymentSettled,
      payload: {
        orderId: ctx.orderId,
        amountCents: ctx.amountCents,
        paymentMethod: ctx.paymentMethod,
      },
    };
  }

  if (trigger.kind === "order_delivered") {
    return {
      type: "emit",
      commandType: COMMERCE_COMMAND_TYPES.recordOrderDelivered,
      eventType: COMMERCE_EVENT_TYPES.orderDelivered,
      payload: { orderId: ctx.orderId },
    };
  }

  if (trigger.kind === "guest_command" && trigger.command.type === "SubmitFeedback") {
    const meta = submitFeedbackCommandMeta();
    return {
      type: "emit",
      commandType: meta.commandType,
      eventType: meta.eventType,
      payload: trigger.command.payload,
    };
  }

  if (
    trigger.kind === "guest_command" &&
    trigger.command.type === "RecordGoogleReviewClick"
  ) {
    const meta = recordGoogleReviewClickCommandMeta();
    return {
      type: "emit",
      commandType: meta.commandType,
      eventType: meta.eventType,
      payload: trigger.command.payload,
    };
  }

  if (
    trigger.kind === "guest_command" &&
    trigger.command.type === "RecordTipSelection"
  ) {
    const meta = recordTipSelectionCommandMeta();
    return {
      type: "emit",
      commandType: meta.commandType,
      eventType: meta.eventType,
      payload: trigger.command.payload,
    };
  }

  return { type: "none", reason: "unsupported_trigger" };
}

export function commerceIdempotencyKey(
  trigger: CommerceTrigger,
  opts: { idempotencyKey?: string }
): string {
  if (opts.idempotencyKey) {
    return opts.idempotencyKey;
  }

  switch (trigger.kind) {
    case "payment_settled":
      return `payment_settled:${trigger.orderId}`;
    case "order_delivered":
      return `order_delivered:${trigger.orderId}`;
    case "session_bill_settled":
      return `session_bill_settled:${trigger.sessionId}`;
    case "guest_command":
      return trigger.idempotencyKey;
    case "floor_tick":
      return `floor_tick:${trigger.locationId}:${trigger.tickAt}`;
    default:
      return `commerce:${Date.now()}`;
  }
}
