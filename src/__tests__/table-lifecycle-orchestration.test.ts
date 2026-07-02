import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { INTERVENTION_MANIFEST_V2 } from "@/lib/denis/cognition/intervention/intervention-manifest-v2";
import { matchInterventionRules } from "@/lib/denis/cognition/intervention/evaluate-intervention-manifest";
import { foldSessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import { evaluateInterventionPipeline } from "@/lib/denis/cognition/intervention/run-intervention-pipeline";
import { lookupInterventionManifest } from "@/lib/denis/cognition/intervention/intervention-manifest-registry";
import {
  applyTableLifecycleToCandidates,
  orchestrateTableLifecycle,
} from "@/lib/denis/cognition/lifecycle/orchestrate-table-lifecycle";
import { deriveScrollPosture } from "@/lib/denis/cognition/mental-model/derive-scroll-posture";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";

const NOW = Date.parse("2026-06-07T20:00:00.000Z");

function sampleOrder(status: string): import("@/lib/denis/loop/types").OrderFact {
  return {
    id: "o1",
    orderNumber: 42,
    status,
    paymentStatus: "paid",
    estimatedPrepMinutes: 12,
    createdAt: "2026-06-07T19:00:00.000Z",
    items: [{ productName: "Burger", quantity: 1, menuSection: "food" }],
  };
}

function browseWithScroll(
  intent: "fast_search" | "slow_category" | "reached_bottom",
  categoryLabel?: string
) {
  return {
    ...emptyBrowseProfile(),
    scrollIntents: [{ intent, categoryLabel, at: "2026-06-07T19:58:00.000Z" }],
  };
}

function minimalState(
  patch?: Partial<Pick<TableSessionState, "mental" | "offer" | "browse">>
): TableSessionState {
  return {
    table: { id: "t1", name: "T1", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: buildMergedCart({ ai: emptyCartState() }),
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "guest.seated",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(NOW),
    offer: emptyGuestOfferContext(NOW),
    config: CONCIERGE_PLATFORM_DEFAULTS,
    ...patch,
  };
}

describe("orchestrateTableLifecycle", () => {
  it("defers generic upsell on slow category scroll", () => {
    const browse = browseWithScroll("slow_category", "Pizza");
    const mental = {
      ...emptyGuestMentalModel(NOW),
      scrollPosture: deriveScrollPosture(browse),
      intent: "exploring" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };

    const lifecycle = orchestrateTableLifecycle({
      mental,
      tableTempoPhase: "none",
      orders: [],
      cartLineCount: 0,
    });

    expect(lifecycle.lane).toBe("explore");
    expect(lifecycle.stage).toBe("browsing");
    expect(lifecycle.suppressedKinds).toContain("browse_nudge");
    expect(lifecycle.preferredKinds).toContain("scroll_category");
  });

  it("boosts scroll_search on fast search lane", () => {
    const browse = browseWithScroll("fast_search");
    const mental = {
      ...emptyGuestMentalModel(NOW),
      scrollPosture: deriveScrollPosture(browse),
      predictedNeed: "needs_help_choosing" as const,
      pace: "rushed" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };

    const lifecycle = orchestrateTableLifecycle({
      mental,
      tableTempoPhase: "none",
      orders: [],
      cartLineCount: 0,
    });

    expect(lifecycle.lane).toBe("help");
    expect(lifecycle.stage).toBe("browsing");
    expect(lifecycle.preferredKinds).toContain("scroll_search");

    const ranked = applyTableLifecycleToCandidates({
      lifecycle,
      candidates: [
        { nudge: { kind: "scroll_search" as const }, priority: 500 },
        { nudge: { kind: "dessert_nudge" as const }, priority: 900 },
      ],
    });

    expect(ranked[0]?.nudge.kind).toBe("scroll_search");
    expect(ranked.some((row) => row.nudge.kind === "dessert_nudge")).toBe(false);
  });
});

describe("ijs-v2 manifest + lifecycle", () => {
  it("registers ijs-v2 and pilot uses it", () => {
    expect(lookupInterventionManifest("ijs-v2")?.version).toBe("ijs-v2");
    expect(TABLE_OS_PILOT_CONFIG_PATCH.intervention?.manifestVersion).toBe(
      "ijs-v2"
    );
  });

  it("matches scroll_fast_search rule", () => {
    const browse = browseWithScroll("fast_search");
    const mental = {
      ...emptyGuestMentalModel(NOW),
      scrollPosture: deriveScrollPosture(browse),
      predictedNeed: "needs_help_choosing" as const,
      intent: "comparing" as const,
    };
    const offer = emptyGuestOfferContext(NOW);
    offer.trace.timing = {
      kind: "browse_pause",
      idleSinceBrowseSec: 15,
      speakWindow: "open",
      ready: true,
      reason: "browse_pause",
    };

    const lifecycle = orchestrateTableLifecycle({
      mental,
      tableTempoPhase: "none",
      orders: [],
      cartLineCount: 0,
    });

    const trajectory = foldSessionTrajectory({
      timeline: [],
      browse,
      mental,
      orders: [],
      cartLineCount: 0,
      timing: offer.trace.timing,
      tableTempoPhase: "none",
      lifecycle,
      nowMs: NOW,
    });

    const matched = matchInterventionRules({
      manifest: INTERVENTION_MANIFEST_V2,
      trajectory,
      mental,
      offerTiming: offer.trace.timing,
    });

    expect(matched.some((row) => row.ruleId === "scroll_fast_search")).toBe(true);
    expect(trajectory.evidence).toContain("scroll.fast_search");
  });

  it("blocks disallowed UPDS kind in enforce mode", () => {
    const browse = browseWithScroll("fast_search");
    const mental = {
      ...emptyGuestMentalModel(NOW),
      scrollPosture: deriveScrollPosture(browse),
      predictedNeed: "needs_help_choosing" as const,
      intent: "comparing" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };
    const offer = emptyGuestOfferContext(NOW);
    offer.trace.timing = {
      kind: "browse_pause",
      idleSinceBrowseSec: 15,
      speakWindow: "open",
      ready: true,
      reason: "browse_pause",
    };

    const state = minimalState({ mental, browse, offer });

    const evaluation = evaluateInterventionPipeline({
      state,
      manifest: INTERVENTION_MANIFEST_V2,
      enforceBlock: true,
      proactiveResult: {
        beliefs: {} as never,
        turnPlan: null,
        nudge: { kind: "dessert_nudge", message: "Dessert?" },
        message: "Dessert?",
        skipped: false,
        skipReason: null,
        candidateKind: "dessert_nudge",
      },
    });

    expect(evaluation.matchedRules.some((row) => row.ruleId === "scroll_fast_search")).toBe(
      true
    );
    expect(evaluation.shouldBlockSpeak).toBe(true);
    expect(evaluation.silenceReason).toBe("ijs.kind_not_allowed");
  });
});

describe("table lifecycle stages (Phase 3)", () => {
  it("eating intent → silence lane, suppresses upsell", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      intent: "eating" as const,
      mealStage: "main" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };

    const lifecycle = orchestrateTableLifecycle({
      mental,
      tableTempoPhase: "none",
      orders: [sampleOrder("delivered")],
      cartLineCount: 0,
    });

    expect(lifecycle.stage).toBe("eating");
    expect(lifecycle.lane).toBe("silence");

    const ranked = applyTableLifecycleToCandidates({
      lifecycle,
      candidates: [
        { nudge: { kind: "dessert_nudge" as const }, priority: 900 },
        { nudge: { kind: "order_delay" as const }, priority: 400 },
      ],
    });

    expect(ranked.map((row) => row.nudge.kind)).toEqual(["order_delay"]);
  });

  it("waiting_food → kitchen service kinds preferred", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      intent: "waiting_food" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };

    const lifecycle = orchestrateTableLifecycle({
      mental,
      tableTempoPhase: "none",
      orders: [sampleOrder("preparing")],
      cartLineCount: 0,
    });

    expect(lifecycle.stage).toBe("waiting_kitchen");
    expect(lifecycle.preferredKinds).toContain("order_eta_update");
  });

  it("dessert_window → dessert upsell lane", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      mealStage: "dessert_window" as const,
      predictedNeed: "wants_dessert" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };

    const lifecycle = orchestrateTableLifecycle({
      mental,
      tableTempoPhase: "post_meal_idle",
      orders: [],
      cartLineCount: 0,
    });

    expect(lifecycle.stage).toBe("dessert");
    expect(lifecycle.preferredKinds).toContain("dessert_nudge");
  });
});
