import type { FeedbackSentiment } from "@/lib/commerce/experience/resolve-experience-moment";
import type { GuestFrustrationLevel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { hashSessionExperimentBucket } from "@/lib/denis/config/ab-experiment";

export type ReviewEligibility = {
  eligible: boolean;
  reason: string;
  /** Seconds after payment before showing the prompt. */
  delay: number;
  route: "google" | "internal" | "none";
};

export type ReviewFunnelRoute = "google" | "internal" | "none";

export const REVIEW_PROMPT_DELAY_SECONDS = 30;
export const REVIEW_PROMPT_COOLDOWN_DAYS = 90;
export const REVIEW_DISMISS_COOLDOWN_DAYS = 180;
export const REVIEW_GOOGLE_MIN_SCORE = 8;
export const REVIEW_INTERNAL_MAX_SCORE = 5;
/** @deprecated use REVIEW_GOOGLE_MIN_SCORE + star rating path */
export const REVIEW_MIN_RATING = 4;

const DAY_MS = 86_400_000;

function daysSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  return (nowMs - parsed) / DAY_MS;
}

export function resolveReviewFunnelRoute(
  experienceScore: number
): ReviewFunnelRoute {
  if (experienceScore > REVIEW_GOOGLE_MIN_SCORE) return "google";
  if (experienceScore < REVIEW_INTERNAL_MAX_SCORE) return "internal";
  return "none";
}

function antiSpamBlocked(input: {
  lastReviewPromptDate: string | null;
  lastReviewDismissDate: string | null;
  nowMs: number;
}): { blocked: boolean; reason: string } {
  const sinceDismiss = daysSince(input.lastReviewDismissDate, input.nowMs);
  if (sinceDismiss != null && sinceDismiss < REVIEW_DISMISS_COOLDOWN_DAYS) {
    return { blocked: true, reason: "dismiss_cooldown" };
  }

  const sincePrompt = daysSince(input.lastReviewPromptDate, input.nowMs);
  if (sincePrompt != null && sincePrompt < REVIEW_PROMPT_COOLDOWN_DAYS) {
    return { blocked: true, reason: "prompt_cooldown" };
  }

  return { blocked: false, reason: "" };
}

/** Denis smart review funnel — experience score routes Google vs internal feedback. */
export function resolveReviewEligibility(input: {
  experienceScore: number;
  frustrationLevel: GuestFrustrationLevel;
  lastReviewPromptDate: string | null;
  lastReviewDismissDate: string | null;
  googleReviewUrl: string | null;
  feedbackSubmitted?: boolean;
  /** Legacy star-rating path when experience score unavailable. */
  feedbackRating?: number | null;
  feedbackSentiment?: FeedbackSentiment | null;
  visitCount?: number;
  nowMs?: number;
}): ReviewEligibility {
  void input.visitCount;
  void input.feedbackSubmitted;
  const nowMs = input.nowMs ?? Date.now();
  const route = resolveReviewFunnelRoute(input.experienceScore);

  if (route === "none") {
    return { eligible: false, reason: "score_mid_band", delay: 0, route: "none" };
  }

  if (input.frustrationLevel === "high") {
    return { eligible: false, reason: "frustration_high", delay: 0, route: "none" };
  }

  const spam = antiSpamBlocked({
    lastReviewPromptDate: input.lastReviewPromptDate,
    lastReviewDismissDate: input.lastReviewDismissDate,
    nowMs,
  });
  if (spam.blocked) {
    return { eligible: false, reason: spam.reason, delay: 0, route: "none" };
  }

  if (route === "google" && !input.googleReviewUrl?.trim()) {
    return { eligible: false, reason: "no_review_url", delay: 0, route: "none" };
  }

  return {
    eligible: true,
    reason: route === "google" ? "experience_score_google" : "experience_score_internal",
    delay: REVIEW_PROMPT_DELAY_SECONDS,
    route,
  };
}

export const REVIEW_PROMPT_EXPERIMENT_ID = "exp-review-prompt-copy";

export type ReviewPromptVariant = "A" | "B";

export const REVIEW_PROMPT_COPY: Record<
  ReviewPromptVariant,
  { sr: string; en: string }
> = {
  A: {
    sr: "Drago nam je! Ako imate 30 sekundi, vaša recenzija na Googleu bi nam puno značila 💛",
    en: "We're glad you enjoyed it! If you have 30 seconds, a Google review would mean a lot to us 💛",
  },
  B: {
    sr: "Hvala vam! Vaša Google recenzija pomaže drugim gostima da nas pronađu ⭐",
    en: "Thank you! Your Google review helps other guests discover us ⭐",
  },
};

export function resolveReviewPromptVariant(
  sessionToken: string
): ReviewPromptVariant {
  const bucket = hashSessionExperimentBucket(
    sessionToken,
    REVIEW_PROMPT_EXPERIMENT_ID
  );
  return bucket < 500 ? "A" : "B";
}

export function buildReviewPromptMessage(
  language?: string | null,
  variant?: ReviewPromptVariant,
  sessionToken?: string | null
): string {
  const resolvedVariant =
    variant ??
    (sessionToken ? resolveReviewPromptVariant(sessionToken) : "A");
  const copy = REVIEW_PROMPT_COPY[resolvedVariant];
  return language === "en" ? copy.en : copy.sr;
}

export function buildInternalFeedbackMessage(language?: string | null): string {
  if (language === "en") {
    return "We want every visit to be great — how was your experience today? Your feedback stays with us.";
  }
  return "Želimo da svaka poseta bude odlična — kako vam je bilo danas? Vaše mišljenje ostaje kod nas.";
}

export function reviewDelayOpen(
  paidAnchorAt: string | null,
  delaySeconds: number,
  nowMs: number
): boolean {
  if (!paidAnchorAt) return false;
  const anchorMs = Date.parse(paidAnchorAt);
  if (!Number.isFinite(anchorMs)) return false;
  const elapsedSec = (nowMs - anchorMs) / 1000;
  return elapsedSec >= delaySeconds;
}
