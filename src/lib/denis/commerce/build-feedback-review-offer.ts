import {
  buildSentimentGatedReviewContent,
  buildReviewContentSuggestion,
} from "@/lib/denis/commerce/experience/review-orchestration";
import {
  REVIEW_PROMPT_DELAY_SECONDS,
} from "@/lib/denis/commerce/review-funnel";

/** Build GoogleReviewSheet offer after guest submits high rating feedback. */
export function buildFeedbackReviewOffer(input: {
  orderId: string;
  googleReviewUrl: string;
  paidAnchorAt: string;
  language?: string | null;
  sessionToken?: string | null;
  orderItems?: Array<{ productName: string; menuSection?: string | null }>;
  experienceScore?: number;
  triggerMoment?: "after_compliment" | "settling_default";
}): import("@/lib/denis/loop/view-types").GoogleReviewOffer {
  void input.sessionToken;
  const language = input.language ?? "sr";
  const contentSuggestion = input.orderItems?.length
    ? buildReviewContentSuggestion({ orderItems: input.orderItems, language })
    : null;
  const gated = buildSentimentGatedReviewContent({
    experienceScore: input.experienceScore ?? 9,
    language,
    contentSuggestion,
    triggerMoment: input.triggerMoment ?? "settling_default",
  });

  return {
    orderId: input.orderId,
    route: "google",
    googleReviewUrl: input.googleReviewUrl.trim(),
    message: gated.message,
    delaySeconds: REVIEW_PROMPT_DELAY_SECONDS,
    paidAnchorAt: input.paidAnchorAt,
    feedbackSubmittedAt: new Date().toISOString(),
    confirmLabel: gated.confirmLabel ?? (language === "en" ? "Leave a review" : "Ostavi recenziju"),
    dismissLabel: gated.dismissLabel ?? (language === "en" ? "Not now" : "Ne sad"),
    triggerMoment: input.triggerMoment ?? "settling_default",
    contentSuggestion: contentSuggestion?.suggestionLine ?? null,
    showInternalForm: false,
    experienceScore: input.experienceScore ?? 9,
  };
}
