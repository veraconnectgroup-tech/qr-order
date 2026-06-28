import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { buildSystemPrompt } from "@/lib/ai/build-system-prompt";
import { belief, beliefGraph, CORE_BELIEF_KEYS } from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import {
  isServiceProactiveKind,
  RECEPTIVENESS_CLOSED_ALLOWED_KINDS,
} from "@/lib/denis/cognition/mental-model/mental-model-intelligence";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import type { TableSessionState } from "@/lib/denis/loop/types";

const NOW = Date.parse("2026-06-07T20:18:00.000Z");

const enforceConfig = {
  ...CONCIERGE_PLATFORM_DEFAULTS,
  mentalModel: {
    ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
    mode: "enforce" as const,
  },
};

const rankMessages = {
  browse: "browse",
  dessert: "dessert",
  slowKitchen: "slow",
  guestWelcome: "welcome",
  browseFollowUp: "follow up",
  billPrompt: "bill",
  orderDelay: "delay",
  popularityPair: "pair",
};

function delayedOrder(): AiGuestOrder {
  return {
    id: "ord-delay",
    status: "preparing",
    created_at: new Date(NOW - 18 * 60_000).toISOString(),
    delivered_at: null,
    estimated_prep_minutes: 12,
    prep_estimate_confidence: "high",
    order_items: [
      {
        product_id: "burger-id",
        product_name: "Burger",
        unit_price: 12,
        quantity: 1,
        menu_section: "food",
      },
    ],
  };
}

function baseState(mental = emptyGuestMentalModel(NOW)): TableSessionState {
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
      cart: { ai: emptyCartState(), visibleLines: [] },
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
      flowNodeId: "collect",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental,
    offer: emptyGuestOfferContext(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

describe("mental model intelligence", () => {
  it("closed receptiveness yields zero upsell candidates (delay service only)", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      receptiveness: "closed" as const,
      decline: {
        dismissedCount: 2,
        explicitCount: 1,
        hardClosed: true,
        lastDeclineAt: NOW,
      },
      mealStage: "dessert_window" as const,
      predictedNeed: "wants_dessert" as const,
      nudgeBudget: { remaining: 0, max: 0, cooldownUntil: null },
    };

    const ranked = rankProactiveCandidates({
      config: enforceConfig,
      orders: [delayedOrder()],
      mental,
      payload: {
        sessionPhase: "waiting",
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
        guestMessageCount: 2,
        browseMinutes: 0,
        idleMinutes: 0,
      },
      messages: rankMessages,
      now: NOW,
    });

    expect(ranked.length).toBeGreaterThan(0);
    expect(
      ranked.every((row) =>
        RECEPTIVENESS_CLOSED_ALLOWED_KINDS.includes(row.nudge.kind)
      )
    ).toBe(true);
    expect(ranked.some((row) => row.nudge.kind === "dessert_nudge")).toBe(false);
    expect(ranked.some((row) => row.nudge.kind === "browse_nudge")).toBe(false);
    expect(
      ranked.some(
        (row) =>
          row.nudge.kind === "slow_kitchen" ||
          row.nudge.kind === "order_eta_update"
      )
    ).toBe(true);
  });

  it("nudge_budget=0 allows service candidates only", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      receptiveness: "open" as const,
      mealStage: "dessert_window" as const,
      predictedNeed: "wants_dessert" as const,
      nudgeBudget: { remaining: 0, max: 2, cooldownUntil: null },
    };

    const ranked = rankProactiveCandidates({
      config: enforceConfig,
      orders: [delayedOrder()],
      mental,
      payload: {
        sessionPhase: "waiting",
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
        guestMessageCount: 2,
        browseMinutes: 0,
        idleMinutes: 0,
      },
      messages: rankMessages,
      now: NOW,
    });

    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.every((row) => isServiceProactiveKind(row.nudge.kind))).toBe(
      true
    );
    expect(ranked.some((row) => row.nudge.kind === "dessert_nudge")).toBe(
      false
    );
  });

  it("adds RUSHED instruction to system prompt when pace is rushed", () => {
    const prompt = buildSystemPrompt({
      orgName: "Skyline Lounge",
      menuText: "",
      language: "sr",
      omitFullMenu: true,
      guestMentalModel: {
        ...emptyGuestMentalModel(NOW),
        pace: "rushed",
        nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
      },
    });

    expect(prompt).toContain("RUSHED GUEST:");
    expect(prompt).toContain("No small talk");
  });

  it("includes GUEST MENTAL MODEL section in situation pack", () => {
    const beliefs = beliefGraph([
      belief(CORE_BELIEF_KEYS.conversationMode, "ordering"),
    ]);

    const pack = buildSituationPack({
      state: baseState({
        ...emptyGuestMentalModel(NOW),
        pace: "rushed",
        priceAffinity: "budget",
        nudgeBudget: { remaining: 0, max: 2, cooldownUntil: null },
      }),
      beliefs,
      sessionPhase: "ordering",
    });

    expect(pack).toContain("GUEST MENTAL MODEL:");
    expect(pack).toContain("- pace: rushed");
    expect(pack).toContain("- price_affinity: budget");
    expect(pack).toContain("RUSHED");
    expect(pack).toContain("nudge_budget: 0/2");
  });
});
