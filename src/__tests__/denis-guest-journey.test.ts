import { describe, expect, it } from "vitest";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { decideProactiveTurnPlan } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { deriveFoldSessionPhase } from "@/lib/denis/loop/derive-fold-phase";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { CORE_BELIEF_KEYS, getBeliefValue } from "@/lib/denis/cognition/beliefs/belief-types";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import {
  ANTICIPATION_EVAL_NOW,
  ANTICIPATION_SCENARIOS,
} from "@/lib/denis/eval/fixtures/anticipation/scenarios";
import {
  buildAnticipationEvalState,
} from "@/lib/denis/eval/run-anticipation-eval";

function baseState(
  overrides: Partial<TableSessionState> = {}
): TableSessionState {
  return {
    table: { id: "t1", name: "Table 8", token: "tok" },
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
      cart: {
        ai: emptyCartState(),
        visibleLines: [],
      },
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
      flowNodeId: "welcome",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
    ...overrides,
  };
}

describe("guest memory journey — GUEST HISTORY", () => {
  it("includes GUEST HISTORY for returning guest", () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
    const memory = emptyGuestMemoryProjection({
      visitCount: 3,
      favoriteItems: ["Pilsner 0.5L", "Schnitzel"],
      allergies: ["gluten"],
      language: "sr",
      avgSpend: 24.5,
      lastVisit: twoWeeksAgo,
      hasMemoryConsent: true,
    });

    const pack = buildSituationPack({
      state: baseState(),
      beliefs: beliefGraph([]),
      guestMemory: memory,
    });

    expect(pack).toContain("GUEST HISTORY:");
    expect(pack).toContain("visits: 3");
    expect(pack).toContain("favorite: Pilsner 0.5L, Schnitzel");
    expect(pack).toContain("allergy: gluten");
    expect(pack).toContain("avg_spend: €24.50");
    expect(pack).toContain("language: sr");
    expect(pack).toContain("last_visit: 2 weeks ago");
    expect(pack).toContain("welcome_back:");
  });
});

describe("journey phase — eating", () => {
  const nowMs = Date.now();
  const deliveredAt = new Date(nowMs - 10 * 60_000).toISOString();

  it("infers eating when food delivered 10 min ago and no open orders", () => {
    const phase = deriveFoldSessionPhase({
      sessionStatus: "active",
      accessState: null,
      hasCartActivity: false,
      billSettled: false,
      nowMs,
      orders: [
        {
          id: "o1",
          orderNumber: 12,
          status: "delivered",
          paymentStatus: "paid",
          estimatedPrepMinutes: 15,
          createdAt: deliveredAt,
          deliveredAt,
          items: [
            {
              productName: "Schnitzel",
              quantity: 1,
              menuSection: "food",
            },
          ],
        },
      ],
    });

    expect(phase).toBe("eating");
  });

  it("situation pack shows eating phase and do-not-disturb behavior", () => {
    const pack = buildSituationPack({
      state: baseState({
        commerce: {
          orders: [
            {
              id: "o1",
              orderNumber: 12,
              status: "delivered",
              paymentStatus: "paid",
              estimatedPrepMinutes: 15,
              createdAt: deliveredAt,
              deliveredAt,
              items: [
                {
                  productName: "Schnitzel",
                  quantity: 1,
                  menuSection: "food",
                },
              ],
            },
          ],
          cart: {
            ai: emptyCartState(),
            visibleLines: [],
          },
        },
      }),
      beliefs: beliefGraph([]),
    });

    expect(pack).toContain("session.phase: eating");
    expect(pack).toContain("DO NOT interrupt");
  });
});

describe("eating phase proactive guards", () => {
  it("suppresses drink refill while eating", () => {
    const result = decideProactiveTurnPlan({
      beliefs: { beliefs: [] },
      candidate: { kind: "drink_refill", message: "Još jedno?" },
      sessionPhase: "eating",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      minutesSinceLastFoodDelivery: 10,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("phase.eating_do_not_disturb");
    }
  });

  it("blocks dessert nudge before 15 min in eating phase", () => {
    const early = decideProactiveTurnPlan({
      beliefs: { beliefs: [] },
      candidate: { kind: "dessert_nudge", message: "Desert?" },
      sessionPhase: "eating",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      minutesSinceLastFoodDelivery: 10,
    });
    expect(early.ok).toBe(false);
    if (!early.ok) {
      expect(early.reason).toBe("phase.eating_dessert_early");
    }

    const late = decideProactiveTurnPlan({
      beliefs: { beliefs: [] },
      candidate: { kind: "dessert_nudge", message: "Desert?" },
      sessionPhase: "eating",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      minutesSinceLastFoodDelivery: 18,
    });
    expect(late.ok).toBe(true);
  });
});

describe("buildSystemPrompt journey phase block", () => {
  it("adds JOURNEY PHASE BEHAVIOR when sessionPhase set without full pack", () => {
    const prompt = buildSystemPrompt({
      orgName: "Demo",
      menuText: "Pilsner 0.5L — 4.50€",
      language: "sr",
      sessionPhase: "eating",
    });

    expect(prompt).toContain("JOURNEY PHASE BEHAVIOR:");
    expect(prompt).toContain("DO NOT disturb");
  });
});

describe("anticipation regression — dessert settling", () => {
  it("dessert-settling-window emits when upsell not suppressed", () => {
    const scenario = ANTICIPATION_SCENARIOS.find(
      (row) => row.id === "dessert-settling-window"
    )!;
    const state = buildAnticipationEvalState(scenario.setup);
    const beliefs = compileBeliefs({ state, guestMessage: "" });

    expect(getBeliefValue(beliefs, CORE_BELIEF_KEYS.venueSkipUpsell)).toBe(true);
    expect(getBeliefValue(beliefs, CORE_BELIEF_KEYS.venueRush)).toBe(false);

    const result = planProactiveTurn({
      state,
      config: state.config,
      orders: state.commerce.orders.map((order) => ({
        id: order.id,
        status: order.status,
        created_at: order.createdAt,
        delivered_at: order.status === "delivered" ? order.createdAt : null,
        order_items: order.items.map((item) => ({
          product_id: null,
          product_name: item.productName,
          unit_price: 0,
          quantity: item.quantity,
          menu_section: "food" as const,
        })),
      })),
      sessionPhase: scenario.setup.sessionPhase,
      payload: scenario.payload,
      now: ANTICIPATION_EVAL_NOW,
    });

    expect(result.skipped, result.skipReason ?? "ok").toBe(false);
    expect(result.nudge?.kind).toBe("dessert_nudge");
  });
});
