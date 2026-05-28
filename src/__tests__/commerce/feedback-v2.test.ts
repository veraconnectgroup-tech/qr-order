import { describe, expect, it } from "vitest";
import {
  ratingToSentiment,
  resolveExperienceMoment,
} from "@/lib/commerce/experience/resolve-experience-moment";
import {
  COMMERCE_COMMAND_TYPES,
  COMMERCE_EVENT_TYPES,
} from "@/lib/commerce/event-types";
import {
  commerceIdempotencyKey,
  resolveCommerceIntent,
} from "@/lib/commerce/runtime/resolve-commerce-intent";
import { submitFeedbackIdempotencyKey } from "@/lib/commerce/capabilities/feedback-v2/submit-feedback";

describe("resolveExperienceMoment (ADR-014 CE-2)", () => {
  it("returns checkout_thanks when paid but meal not complete", () => {
    expect(
      resolveExperienceMoment({
        paymentStatus: "paid",
        orderStatus: "preparing",
        sessionBillSettled: false,
        allSessionOrdersDelivered: false,
      })
    ).toBe("checkout_thanks");
  });

  it("returns feedback_eligible when delivered and paid", () => {
    expect(
      resolveExperienceMoment({
        paymentStatus: "paid",
        orderStatus: "delivered",
        sessionBillSettled: false,
        allSessionOrdersDelivered: true,
      })
    ).toBe("feedback_eligible");
  });

  it("returns none when feedback already submitted", () => {
    expect(
      resolveExperienceMoment({
        paymentStatus: "paid",
        orderStatus: "delivered",
        sessionBillSettled: false,
        allSessionOrdersDelivered: true,
        feedbackAlreadySubmitted: true,
      })
    ).toBe("none");
  });
});

describe("feedback v2 commerce intent", () => {
  it("maps rating to sentiment", () => {
    expect(ratingToSentiment(5)).toBe("positive");
    expect(ratingToSentiment(3)).toBe("neutral");
    expect(ratingToSentiment(1)).toBe("negative");
  });

  it("resolves SubmitFeedback guest command", () => {
    const intent = resolveCommerceIntent(
      {
        kind: "guest_command",
        sessionId: "sess-1",
        idempotencyKey: submitFeedbackIdempotencyKey("sess-1"),
        command: {
          type: "SubmitFeedback",
          payload: {
            orderId: "order-1",
            rating: 2,
            sentiment: "negative",
            category: "service",
          },
        },
      },
      {
        paymentStatus: "paid",
        paymentMethod: "card",
        amountCents: 0,
        orderId: "order-1",
      }
    );

    expect(intent).toEqual({
      type: "emit",
      commandType: COMMERCE_COMMAND_TYPES.submitFeedback,
      eventType: COMMERCE_EVENT_TYPES.feedbackSubmitted,
      payload: {
        orderId: "order-1",
        rating: 2,
        sentiment: "negative",
        category: "service",
      },
    });
  });

  it("uses stable session idempotency key for feedback", () => {
    expect(submitFeedbackIdempotencyKey("sess-abc")).toBe(
      "feedback_submitted:sess-abc"
    );
    expect(
      commerceIdempotencyKey(
        {
          kind: "guest_command",
          sessionId: "sess-abc",
          idempotencyKey: submitFeedbackIdempotencyKey("sess-abc"),
          command: {
            type: "SubmitFeedback",
            payload: { orderId: "o1", rating: 5, sentiment: "positive" },
          },
        },
        {}
      )
    ).toBe("feedback_submitted:sess-abc");
  });
});
