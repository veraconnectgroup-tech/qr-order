import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";

export type RecordGoogleReviewClickPayload = {
  orderId: string;
  googleReviewUrl: string;
  triggerMoment?: string | null;
};

export function buildRecordGoogleReviewClickPayload(
  input: RecordGoogleReviewClickPayload
): Record<string, unknown> {
  return {
    orderId: input.orderId,
    googleReviewUrl: input.googleReviewUrl,
    triggerMoment: input.triggerMoment ?? null,
  };
}

export function recordGoogleReviewClickCommandMeta() {
  return {
    commandType: COMMERCE_COMMAND_TYPES.recordGoogleReviewClick,
    eventType: COMMERCE_EVENT_TYPES.reviewGoogleClicked,
  };
}

export function recordGoogleReviewClickIdempotencyKey(orderId: string): string {
  return `review_google_clicked:${orderId}`;
}
