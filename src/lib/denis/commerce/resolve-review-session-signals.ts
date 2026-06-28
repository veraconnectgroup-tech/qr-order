import type { TableSessionState } from "@/lib/denis/loop/types";
import type { DetectReviewMomentInput } from "@/lib/denis/cognition/proactive/detect-review-moment";
import type { SessionPhase } from "@/lib/scene/types";

export function sessionHasTipRecorded(
  orders: Array<{ tipAmount?: number | null }>
): boolean {
  return orders.some((order) => (order.tipAmount ?? 0) > 0);
}

function sessionDurationMinutes(
  orders: Array<{ createdAt: string }>,
  nowMs: number
): number | null {
  if (!orders.length) return null;
  const firstMs = Math.min(
    ...orders.map((order) => Date.parse(order.createdAt)).filter(Number.isFinite)
  );
  if (!Number.isFinite(firstMs)) return null;
  return Math.max(0, (nowMs - firstMs) / 60_000);
}

function recoveryCompletedFromTimeline(
  timeline: TableSessionState["timeline"]
): boolean {
  return timeline.some((row) => {
    const kind = String(row.event_type ?? "").toLowerCase();
    const payload = row.payload as Record<string, unknown> | null;
    if (kind.includes("recovery") && payload?.completed === true) return true;
    if (payload?.recoveryCompleted === true) return true;
    return false;
  });
}

/** Fold session state into optimal review moment inputs. */
export function resolveReviewSessionSignals(
  state: TableSessionState,
  phase: SessionPhase,
  input?: {
    nowMs?: number;
    waitingForBill?: boolean;
    recoveryCompleted?: boolean;
    postRecoveryEligible?: boolean;
    kdsStress?: "normal" | "high";
  }
): {
  momentInput: DetectReviewMomentInput;
  orderItems: Array<{ productName: string; menuSection?: string | null }>;
} {
  const nowMs = input?.nowMs ?? Date.now();
  const recoveryCompleted =
    input?.recoveryCompleted ?? recoveryCompletedFromTimeline(state.timeline);
  const lowScore =
    (state.session.feedbackSentiment === "negative" ||
      (state.session.feedbackRating != null && state.session.feedbackRating <= 2)) &&
    state.session.feedbackSubmitted;

  const orderItems = state.commerce.orders.flatMap((order) =>
    order.items.map((item) => ({
      productName: item.productName,
      menuSection: item.menuSection ?? null,
    }))
  );

  return {
    orderItems,
    momentInput: {
      phase,
      mealStage: state.mental.mealStage ?? null,
      billSettled: state.session.billSettled,
      waitingForBill: input?.waitingForBill ?? !state.session.billSettled,
      guestComplimentText: null,
      tipRecorded: sessionHasTipRecorded(state.commerce.orders),
      kdsStress:
        input?.kdsStress ??
        (state.venue?.opsEffects?.capacityBanner?.level === "red"
          ? "high"
          : "normal"),
      sessionDurationMinutes: sessionDurationMinutes(
        state.commerce.orders,
        nowMs
      ),
      recoveryCompleted,
      postRecoveryEligible: input?.postRecoveryEligible ?? lowScore,
      lastGuestMessage: state.conversation.model?.thread?.lastGuestText ?? null,
    },
  };
}
