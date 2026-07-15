import { apiSuccess } from "@/lib/api-response";
import type { TurnPlan } from "@/lib/denis/cognition/tde";
import type { GuestReorderActResult } from "@/lib/denis/runtime/act/apply-guest-reorder-act";
import type { TdePerceiveResult } from "@/lib/denis/runtime/phases/phase-types";

export function buildGuestReorderActPerceiveResult(
  act: Extract<GuestReorderActResult, { resolved: true }>,
  suppressUpsell: boolean,
  tier: string
): TdePerceiveResult {
  const turnPlan: TurnPlan = {
    kind: "reflex_only",
    requiresLlm: false,
    suppressUpsell,
    reason: "act.reorder.guest_request",
  };

  return {
    response: apiSuccess({
      message: act.message,
      recommendations: [],
      cartActions: act.cartActions,
      quickReplies: act.quickReplies,
      intent: act.structuredPerception.intent,
      submitOrder: act.structuredPerception.submitOrder ?? false,
      sessionId: act.sessionId,
      structuredPerception: act.structuredPerception,
    }),
    turnPlan,
    llmUsed: false,
    planKind: turnPlan.kind,
    tier,
    evidencePointers: ["act.reorder"],
    pendingSlotActResolved: true,
    cartDraftFromAct: act.cartDraft,
  };
}
