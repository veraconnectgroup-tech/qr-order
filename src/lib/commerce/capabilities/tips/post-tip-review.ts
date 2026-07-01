import type { DetectReviewMomentInput } from "@/lib/denis/cognition/proactive/detect-review-moment";
import { REVIEW_GOOGLE_MIN_SCORE } from "@/lib/denis/commerce/review-funnel";

export type PostTipReviewSignal = {
  triggerMoment: "after_tip";
  reviewEligible: boolean;
  /** Tip moment skips the default 30s payment delay. */
  delaySeconds: 0;
};

/** Wire review orchestration after guest leaves a tip (L2). */
export function buildPostTipReviewSignal(input: {
  experienceScore: number;
  tipRecorded: boolean;
}): PostTipReviewSignal | null {
  if (!input.tipRecorded) return null;
  if (input.experienceScore <= REVIEW_GOOGLE_MIN_SCORE) return null;
  return {
    triggerMoment: "after_tip",
    reviewEligible: true,
    delaySeconds: 0,
  };
}

export function mergePostTipReviewMoment(
  base: DetectReviewMomentInput,
  tipRecorded: boolean
): DetectReviewMomentInput {
  return {
    ...base,
    tipRecorded: base.tipRecorded || tipRecorded,
  };
}
