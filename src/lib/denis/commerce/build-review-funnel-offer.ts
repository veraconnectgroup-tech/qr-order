import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import type { CommercePolicy } from "@/lib/commerce/policy/commerce-policy.schema";
import {
  detectOptimalReviewMoment,
  isReviewMomentReady,
  type ReviewTriggerMoment,
} from "@/lib/denis/cognition/proactive/detect-review-moment";
import {
  buildReviewContentSuggestion,
  buildSentimentGatedReviewContent,
  resolveRecoveryReviewState,
} from "@/lib/denis/commerce/experience/review-orchestration";
import {
  resolveReviewEligibility,
  reviewDelayOpen,
} from "@/lib/denis/commerce/review-funnel";
import { resolveReviewSessionSignals } from "@/lib/denis/commerce/resolve-review-session-signals";
import {
  buildSessionExperienceScore,
  frustrationFromMental,
  resolvePaidAnchorAt,
} from "@/lib/denis/commerce/session-experience-score";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { GoogleReviewOffer } from "@/lib/denis/loop/view-types";
import { isPaidPaymentStatus } from "@/lib/orders/payment-status";
import type { SessionPhase } from "@/lib/scene/types";

const MEAL_PHASES: SessionPhase[] = ["browsing", "ordering", "waiting"];

const DELAY_BYPASS_MOMENTS: ReviewTriggerMoment[] = [
  "after_compliment",
  "after_tip",
  "post_recovery",
];

function resolveFeedbackTargetOrder(
  orders: TableSessionState["commerce"]["orders"]
) {
  const paid = orders.filter((order) => isPaidPaymentStatus(order.paymentStatus));
  return paid[paid.length - 1] ?? orders[orders.length - 1] ?? null;
}

function shouldBypassReviewDelay(moment: ReviewTriggerMoment | null): boolean {
  return moment != null && DELAY_BYPASS_MOMENTS.includes(moment);
}

/** Sentiment-driven review funnel offer — Google, internal, or post-recovery ask. */
export function buildReviewFunnelOffer(input: {
  state: TableSessionState;
  phase: SessionPhase;
  googleReviewUrl: string | null;
  language?: string;
  policy?: CommercePolicy;
  nowMs?: number;
  recoveryCompleted?: boolean;
}): GoogleReviewOffer | null {
  void input.policy;
  if (MEAL_PHASES.includes(input.phase)) return null;

  const nowMs = input.nowMs ?? Date.now();
  const language = input.language ?? "sr";
  const experience = buildSessionExperienceScore(input.state);
  const paidAnchorAt = resolvePaidAnchorAt(input.state.commerce.orders);
  if (!paidAnchorAt) return null;

  const { momentInput, orderItems } = resolveReviewSessionSignals(
    input.state,
    input.phase,
    {
      nowMs,
      recoveryCompleted: input.recoveryCompleted,
      serviceRecoveryReviewBlockMinutes:
        input.state.config?.ops?.serviceRecovery?.reviewBlockMinutes ?? 120,
    }
  );

  const momentResult = detectOptimalReviewMoment(momentInput);
  if (!isReviewMomentReady(momentResult)) return null;

  const recovery = resolveRecoveryReviewState({
    experienceScore: experience.overallScore,
    recoveryCompleted: momentInput.recoveryCompleted ?? false,
    recoveryIssueLabel: input.state.guest?.lastFeedbackCategory ?? null,
    guestSentimentAfterRecovery: input.state.guest?.lastFeedbackSentiment ?? null,
    language,
  });

  const postRecoveryGoogle =
    recovery.eligibleForGoogleAfterRecovery &&
    momentResult.moment === "post_recovery";

  const eligibility = resolveReviewEligibility({
    experienceScore: experience.overallScore,
    frustrationLevel: frustrationFromMental(input.state.mental),
    lastReviewPromptDate: input.state.guest?.lastReviewPromptAt ?? null,
    lastReviewDismissDate: input.state.guest?.lastReviewDismissAt ?? null,
    googleReviewUrl: input.googleReviewUrl,
    nowMs,
  });

  let route: "google" | "internal" | "thanks_only" | "none" = "none";
  if (postRecoveryGoogle) {
    route = "google";
  } else if (eligibility.eligible) {
    route =
      eligibility.route === "google"
        ? "google"
        : eligibility.route === "internal"
          ? "internal"
          : "none";
  }

  if (route === "none") return null;

  const delayOk =
    reviewDelayOpen(paidAnchorAt, eligibility.delay, nowMs) ||
    shouldBypassReviewDelay(momentResult.moment);
  if (!delayOk) return null;

  if (route === "google" && !input.googleReviewUrl?.trim()) return null;

  const targetOrder = resolveFeedbackTargetOrder(input.state.commerce.orders);
  if (!targetOrder) return null;

  const contentSuggestion = buildReviewContentSuggestion({
    orderItems,
    language,
  });

  const gated = buildSentimentGatedReviewContent({
    experienceScore: postRecoveryGoogle ? 9 : experience.overallScore,
    language,
    contentSuggestion,
    triggerMoment: momentResult.moment,
  });

  const message =
    recovery.followUpMessage && route === "google" && postRecoveryGoogle
      ? `${recovery.followUpMessage} ${gated.message}`
      : gated.message;

  return {
    orderId: targetOrder.id,
    route: route === "google" ? "google" : "internal",
    googleReviewUrl:
      route === "google" ? input.googleReviewUrl!.trim() : null,
    message,
    delaySeconds: shouldBypassReviewDelay(momentResult.moment)
      ? 0
      : eligibility.delay,
    paidAnchorAt,
    feedbackSubmittedAt: input.state.session.feedbackSubmittedAt ?? null,
    confirmLabel: gated.confirmLabel ?? "",
    dismissLabel: gated.dismissLabel ?? "",
    triggerMoment: momentResult.moment ?? undefined,
    contentSuggestion: contentSuggestion?.suggestionLine ?? null,
    showInternalForm: gated.showInternalForm,
    experienceScore: experience.overallScore,
    recoveryFollowUpMessage: recovery.followUpMessage,
  };
}
