import type { FeedbackSentiment } from "@/lib/commerce/experience/resolve-experience-moment";
import {
  EXPERIENCE_HIGH_THRESHOLD,
  EXPERIENCE_LOW_THRESHOLD,
} from "@/lib/commerce/experience/resolve-experience-moment";
import type { ReviewTriggerMoment } from "@/lib/denis/cognition/proactive/detect-review-moment";

export type ReviewOrchestrationRoute = "google" | "internal" | "thanks_only" | "none";

export type SentimentGatedReviewContent = {
  route: ReviewOrchestrationRoute;
  message: string;
  confirmLabel?: string;
  dismissLabel?: string;
  showGoogleLink: boolean;
  showInternalForm: boolean;
};

export type ReviewContentSuggestion = {
  productName: string;
  suggestionLine: string;
};

export type RecoveryReviewState = {
  eligibleForGoogleAfterRecovery: boolean;
  followUpMessage: string | null;
  recoveryOfferMessage: string | null;
};

function isEnglish(language?: string | null): boolean {
  return (language?.trim().toLowerCase() ?? "sr").startsWith("en");
}

/** Sentiment-gated review copy — score > 8 Google, 5–8 thanks only, < 5 internal. */
export function buildSentimentGatedReviewContent(input: {
  experienceScore: number;
  language?: string | null;
  contentSuggestion?: ReviewContentSuggestion | null;
  triggerMoment?: ReviewTriggerMoment | null;
}): SentimentGatedReviewContent {
  const english = isEnglish(input.language);
  const suggestion = input.contentSuggestion?.suggestionLine?.trim();

  if (input.experienceScore > EXPERIENCE_HIGH_THRESHOLD) {
    const base = english
      ? "We would really appreciate a review! ⭐"
      : "Bili bismo zahvalni za recenziju! ⭐";
    const message = suggestion ? `${base} ${suggestion}` : base;
    return {
      route: "google",
      message,
      confirmLabel: english ? "Leave a Google review" : "Ostavi Google recenziju",
      dismissLabel: english ? "Not now" : "Ne sad",
      showGoogleLink: true,
      showInternalForm: false,
    };
  }

  if (
    input.experienceScore >= EXPERIENCE_LOW_THRESHOLD &&
    input.experienceScore <= EXPERIENCE_HIGH_THRESHOLD
  ) {
    return {
      route: "thanks_only",
      message: english
        ? "Thank you for dining with us!"
        : "Hvala što ste bili kod nas!",
      showGoogleLink: false,
      showInternalForm: false,
    };
  }

  return {
    route: "internal",
    message: english
      ? "We're sorry if something wasn't quite right. You can tell us directly — we'll make it right."
      : "Žao nam je ako nešto nije bilo po vašoj želji. Možete nam javiti direktno.",
    confirmLabel: english ? "Share feedback" : "Pošalji povratnu info",
    dismissLabel: english ? "Not now" : "Ne sad",
    showGoogleLink: false,
    showInternalForm: true,
  };
}

/** Pick hero dish from session orders for personalized review suggestion. */
export function buildReviewContentSuggestion(input: {
  orderItems: Array<{ productName: string; menuSection?: string | null }>;
  language?: string | null;
}): ReviewContentSuggestion | null {
  const foodItems = input.orderItems.filter((item) => {
    const section = (item.menuSection ?? "").toLowerCase();
    return section !== "drinks" && section !== "bar";
  });

  const hero =
    foodItems[0]?.productName?.trim() ||
    input.orderItems[0]?.productName?.trim();
  if (!hero) return null;

  const english = isEnglish(input.language);
  return {
    productName: hero,
    suggestionLine: english
      ? `Mention our ${hero}! 😉`
      : `Spomenite naš ${hero}! 😉`,
  };
}

/** Negative experience → internal only; after staff recovery → optional Google ask. */
export function resolveRecoveryReviewState(input: {
  experienceScore: number;
  recoveryCompleted: boolean;
  recoveryIssueLabel?: string | null;
  guestSentimentAfterRecovery?: FeedbackSentiment | null;
  language?: string | null;
}): RecoveryReviewState {
  const english = isEnglish(input.language);
  const lowScore = input.experienceScore < EXPERIENCE_LOW_THRESHOLD;

  if (!lowScore) {
    return {
      eligibleForGoogleAfterRecovery: false,
      followUpMessage: null,
      recoveryOfferMessage: null,
    };
  }

  if (!input.recoveryCompleted) {
    return {
      eligibleForGoogleAfterRecovery: false,
      followUpMessage: null,
      recoveryOfferMessage: null,
    };
  }

  const issue = input.recoveryIssueLabel?.trim() || (english ? "the issue" : "problem");
  const followUpMessage = english
    ? `We fixed ${issue}. Dessert is on us next time — hope you'll give us another chance!`
    : `Ispravili smo ${issue}. Sledeći put je desert na nas.`;

  const willing =
    input.guestSentimentAfterRecovery === "positive" ||
    input.guestSentimentAfterRecovery === "neutral";

  return {
    eligibleForGoogleAfterRecovery: willing,
    followUpMessage,
    recoveryOfferMessage: followUpMessage,
  };
}

export type ReviewTriggerAnalyticsRow = {
  triggerMoment: ReviewTriggerMoment | "unknown";
  prompted: number;
  converted: number;
  sentimentBand: "high" | "mid" | "low";
};

export function aggregateReviewTriggerAnalytics(input: {
  rows: Array<{
    triggerMoment?: string | null;
    experienceScore: number;
    converted?: boolean;
  }>;
}): {
  byTrigger: Record<string, { prompted: number; converted: number; rate: number }>;
  avgRating: number | null;
  sentimentDistribution: Record<"high" | "mid" | "low", number>;
} {
  const byTrigger: Record<string, { prompted: number; converted: number; rate: number }> =
    {};
  const sentimentDistribution = { high: 0, mid: 0, low: 0 };
  let scoreSum = 0;
  let scoreCount = 0;

  for (const row of input.rows) {
    const moment = row.triggerMoment?.trim() || "unknown";
    const bucket = byTrigger[moment] ?? { prompted: 0, converted: 0, rate: 0 };
    bucket.prompted += 1;
    if (row.converted) bucket.converted += 1;
    bucket.rate = bucket.prompted > 0 ? bucket.converted / bucket.prompted : 0;
    byTrigger[moment] = bucket;

    if (row.experienceScore > EXPERIENCE_HIGH_THRESHOLD) {
      sentimentDistribution.high += 1;
    } else if (row.experienceScore >= EXPERIENCE_LOW_THRESHOLD) {
      sentimentDistribution.mid += 1;
    } else {
      sentimentDistribution.low += 1;
    }

    scoreSum += row.experienceScore;
    scoreCount += 1;
  }

  return {
    byTrigger,
    avgRating: scoreCount > 0 ? Math.round((scoreSum / scoreCount) * 10) / 10 : null,
    sentimentDistribution,
  };
}
