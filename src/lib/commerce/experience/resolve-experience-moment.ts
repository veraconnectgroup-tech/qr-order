export type FeedbackSentiment = "positive" | "neutral" | "negative";

export type FeedbackCategory = "food" | "service" | "wait_time" | "other";

export type ExperienceMoment =
  | "checkout_thanks"
  | "feedback_eligible"
  | "none";

/** ADR-013/014 — when to prompt for feedback vs thank-only. */
export function resolveExperienceMoment(input: {
  paymentStatus: string;
  orderStatus: string;
  sessionBillSettled: boolean;
  allSessionOrdersDelivered: boolean;
  feedbackAlreadySubmitted?: boolean;
}): ExperienceMoment {
  if (input.feedbackAlreadySubmitted) {
    return "none";
  }

  if (input.paymentStatus !== "paid" && input.paymentStatus !== "pos_online") {
    return "none";
  }

  const mealComplete =
    input.sessionBillSettled ||
    input.orderStatus === "delivered" ||
    input.allSessionOrdersDelivered;

  if (!mealComplete) {
    return "checkout_thanks";
  }

  return "feedback_eligible";
}

export function ratingToSentiment(rating: number): FeedbackSentiment {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

export function isPaidForExperience(paymentStatus: string): boolean {
  return paymentStatus === "paid" || paymentStatus === "pos_online";
}
