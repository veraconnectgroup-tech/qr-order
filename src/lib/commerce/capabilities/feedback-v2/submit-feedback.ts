import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import type {
  FeedbackCategory,
  FeedbackSentiment,
} from "@/lib/commerce/experience/resolve-experience-moment";

export type SubmitFeedbackPayload = {
  orderId: string;
  rating: number;
  sentiment: FeedbackSentiment;
  category?: FeedbackCategory | null;
  comment?: string | null;
  triggerMoment?: "session_bill" | "order_delivered" | "payment";
  guestTokenHash?: string | null;
};

export function buildSubmitFeedbackPayload(
  input: SubmitFeedbackPayload
): Record<string, unknown> {
  return {
    orderId: input.orderId,
    rating: input.rating,
    sentiment: input.sentiment,
    category: input.category ?? null,
    comment: input.comment ?? null,
    triggerMoment: input.triggerMoment ?? "order_delivered",
    guestTokenHash: input.guestTokenHash ?? null,
  };
}

export function submitFeedbackCommandMeta() {
  return {
    commandType: COMMERCE_COMMAND_TYPES.submitFeedback,
    eventType: COMMERCE_EVENT_TYPES.feedbackSubmitted,
  };
}

export function submitFeedbackIdempotencyKey(sessionId: string): string {
  return `feedback_submitted:${sessionId}`;
}
