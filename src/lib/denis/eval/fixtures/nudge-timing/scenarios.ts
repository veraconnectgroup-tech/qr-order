import { guestMessageRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import { foldGuestSignals } from "@/lib/denis/cognition/mental-model/fold-guest-signals";
import { deriveAffect } from "@/lib/denis/cognition/mental-model/derive-affect";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import type { AiGuestOrder } from "@/lib/ai/order-context";

const NOW = Date.parse("2026-07-20T19:00:00.000Z");
export const NUDGE_TIMING_EVAL_NOW = NOW;

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

/**
 * The single delivered main course every scenario shares — matches the
 * shape denis-proactive-rank.test.ts's own "T4 enforce" test uses
 * (deliveredFoodOrder), so dessert eligibility (hasMainCourseInOrders,
 * !hasDessertInOrders) is satisfied the same real way that test already
 * proves works.
 */
export const NUDGE_TIMING_ORDER: AiGuestOrder = {
  id: "ord-timing-dessert",
  status: "delivered",
  created_at: isoSecondsAgo(1500),
  delivered_at: isoSecondsAgo(1500),
  order_items: [
    {
      product_id: null,
      product_name: "Steak",
      unit_price: 0,
      quantity: 1,
      menu_section: "food",
    },
  ],
};

/**
 * Blind-spot eval #4 — proactive nudge TIMING judgment, not threshold math.
 *
 * denis-proactive-rank.test.ts's "T4 enforce" test already proves the
 * dessert MECHANICAL trigger works (mealStage === "dessert_window" ranks
 * dessert_nudge). What it never tests is TIMING: does firing that nudge
 * respect whether NOW is actually a good moment — e.g. right after the
 * guest was visibly upset.
 *
 * There IS a real mechanism for this — deriveAffect (see
 * src/lib/denis/cognition/mental-model/derive-affect.ts) turns a
 * complaint-classified guest message into frustration.level "mild", and
 * evaluateProactivePolicyForKind's GLOBAL_UPSELL_DENY
 * ("frustration_blocks_upsell", see proactive-policy-defaults.ts) blocks
 * every upsell kind — including dessert_nudge — while frustration is mild
 * or high (config.mentalModel.frustrationEscalateThreshold defaults to
 * "mild", see concierge-defaults.ts), when mentalModelMode is "enforce".
 *
 * These fixtures build `mental` the same way the existing T4 rank test
 * does — mealStage/predictedNeed/budget set directly (that mechanical
 * wiring is already proven elsewhere) — but compute `affect` for real, by
 * running an actual realistic guest message through foldGuestSignals +
 * deriveAffect, the same functions the live perceive pipeline uses. That's
 * the part nothing previously exercised: does the frustration this
 * produces actually gate the dessert nudge at decision time.
 */
export type NudgeTimingScenario = {
  id: string;
  description: string;
  timeline: DenisTimelineRow[];
  /** Expected pickProactiveCandidate() outcome. */
  expectDessertNudge: boolean;
};

function buildMentalFor(timeline: DenisTimelineRow[]): GuestMentalModel {
  const spine = foldGuestSignals({ timeline, dismissedNudgeKeys: [] });
  const affect = deriveAffect(spine);
  return {
    ...emptyGuestMentalModel(NOW),
    // Above config.mentalModel.confidenceFallbackThreshold (0.4, see
    // concierge-defaults.ts) so pickProactiveCandidate's low-confidence
    // fallback path doesn't mask the frustration-gate outcome we're
    // actually testing here.
    confidence: 1,
    mealStage: "dessert_window",
    predictedNeed: "wants_dessert",
    receptiveness: "open",
    nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
    affect,
  };
}

export const NUDGE_TIMING_SCENARIOS: NudgeTimingScenario[] = [
  {
    id: "gmm-recent-complaint-blocks-dessert",
    description:
      "Guest complained ~30s ago (still in the recent signal window) — dessert nudge must NOT fire despite the dessert-window timer being ready",
    timeline: [
      guestMessageRow(1, "nisam dobio pola porudžbine, ovo je katastrofa", isoSecondsAgo(30)),
    ],
    expectDessertNudge: false,
  },
  {
    id: "gmm-calm-meal-dessert-fires",
    description:
      "Guest had a smooth, simple meal with no complaints — dessert nudge SHOULD fire once the window is ready",
    timeline: [guestMessageRow(1, "hvala, bilo je odlično", isoSecondsAgo(1200))],
    expectDessertNudge: true,
  },
];

export function buildNudgeTimingMental(scenario: NudgeTimingScenario): GuestMentalModel {
  return buildMentalFor(scenario.timeline);
}

/**
 * DOCUMENTED, CURRENTLY-OPEN GAP (not run through the pass/fail gate) — see
 * the eval-level writeup in run-nudge-timing-eval.ts. The message below
 * reads as a genuinely heavy, sad moment to any human ("this place reminds
 * me of someone I lost") but classifyGuestIntent (semantic-intent-router.ts)
 * scores it "smalltalk" at 0 confidence — it hits none of
 * isGuestComplaintMessage / isGuestStatusQueryMessage's patterns, so
 * deriveAffect never raises frustration, and the dessert nudge fires
 * exactly as if nothing had happened. Verified directly against the real
 * classifier before writing this fixture (not assumed).
 */
export const NUDGE_TIMING_GAP_SCENARIO: NudgeTimingScenario = {
  id: "gmm-emotional-moment-not-keyword-blocks-dessert",
  description:
    "GAP: guest expresses a genuinely heavy, sad moment with no complaint/status keywords — current mechanical gate has no concept of this and lets the dessert nudge fire anyway",
  timeline: [
    guestMessageRow(1, "Ovo mesto me podseća na nekog koga sam izgubio.", isoSecondsAgo(30)),
  ],
  // Documents CURRENT (undesirable) behavior — see run-nudge-timing-eval.ts.
  expectDessertNudge: true,
};
