import type { GuestAffect } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { SessionPhase } from "@/lib/scene/types";

export type ReviewTriggerMoment =
  | "after_compliment"
  | "after_tip"
  | "waiting_bill"
  | "post_recovery"
  | "settling_default";

export type ReviewMomentBlockReason =
  | "still_eating"
  | "guest_rushed"
  | "no_optimal_window";

const RUSH_SESSION_MAX_MINUTES = 25;
const POSITIVE_AFFECT_THRESHOLD = 0.5;

export type DetectReviewMomentInput = {
  phase: SessionPhase;
  mealStage?: string | null;
  billSettled: boolean;
  waitingForBill?: boolean;
  guestComplimentText?: string | null;
  tipRecorded?: boolean;
  kdsStress?: "normal" | "high";
  sessionDurationMinutes?: number | null;
  recoveryCompleted?: boolean;
  postRecoveryEligible?: boolean;
  lastGuestMessage?: string | null;
  /** Folded guest affect — positive sentiment triggers compliment moment. */
  guestAffect?: Pick<GuestAffect, "sentiment"> | null;
};

export type ReviewMomentResult = {
  moment: ReviewTriggerMoment | null;
  blocked: ReviewMomentBlockReason | null;
  priority: number;
};

function guestComplimentDetected(input: DetectReviewMomentInput): boolean {
  const affectScore = input.guestAffect?.sentiment.score;
  if (affectScore != null && affectScore >= POSITIVE_AFFECT_THRESHOLD) {
    return true;
  }
  return false;
}

function isStillEating(input: DetectReviewMomentInput): boolean {
  if (input.phase === "eating") return true;
  if (input.mealStage === "eating" || input.mealStage === "main_course") {
    return true;
  }
  return false;
}

function isGuestRushed(input: DetectReviewMomentInput): boolean {
  if (input.kdsStress === "high") return true;
  if (
    input.sessionDurationMinutes != null &&
    input.sessionDurationMinutes > 0 &&
    input.sessionDurationMinutes < RUSH_SESSION_MAX_MINUTES &&
    input.phase === "waiting"
  ) {
    return true;
  }
  return false;
}

/**
 * Optimal review moment — Denis asks at the right time, not too early or late.
 * Blocks: still eating, rushed visit. Prefers: compliment, tip, waiting for bill.
 */
export function detectOptimalReviewMoment(
  input: DetectReviewMomentInput
): ReviewMomentResult {
  if (isStillEating(input)) {
    return { moment: null, blocked: "still_eating", priority: 0 };
  }

  if (isGuestRushed(input)) {
    return { moment: null, blocked: "guest_rushed", priority: 0 };
  }

  if (input.postRecoveryEligible && input.recoveryCompleted) {
    return { moment: "post_recovery", blocked: null, priority: 95 };
  }

  if (guestComplimentDetected(input)) {
    return { moment: "after_compliment", blocked: null, priority: 90 };
  }

  if (input.tipRecorded) {
    return { moment: "after_tip", blocked: null, priority: 85 };
  }

  if (input.waitingForBill || (input.billSettled && input.phase === "settling")) {
    return { moment: "waiting_bill", blocked: null, priority: 75 };
  }

  if (input.phase === "settling" || input.phase === "closed") {
    return { moment: "settling_default", blocked: null, priority: 60 };
  }

  return { moment: null, blocked: "no_optimal_window", priority: 0 };
}

/** Whether the detected moment is strong enough to prompt now. */
export function isReviewMomentReady(result: ReviewMomentResult): boolean {
  return result.moment != null && result.priority >= 60;
}
