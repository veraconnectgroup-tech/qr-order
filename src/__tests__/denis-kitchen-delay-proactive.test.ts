import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import {
  buildOrderDelayMessage,
  buildSlowKitchenMessage,
} from "@/lib/denis/cognition/proactive/proactive-message-builders";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import {
  DEFAULT_LATE_FALLBACK_MINUTES,
  delayThresholdMinutes,
  detectKitchenBusyTrigger,
  detectKitchenStaffEscalation,
  detectMultiTableDelayAlert,
  detectOrderDelayTrigger,
  detectOrderEtaUpdateTrigger,
  detectOrderReadyNotifyTrigger,
  detectSlowKitchenTrigger,
  estimateRemainingPrepMinutes,
  hasActiveDrinkOrder,
} from "@/lib/denis/cognition/proactive/triggers";
import { decideProactiveTurnPlan } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import {
  compileBeliefs,
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/beliefs";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import {
  cloneConciergePlatformDefaults,
  CONCIERGE_PLATFORM_DEFAULTS,
} from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { evaluateGuestProactiveTick } from "@/lib/denis/runtime/evaluate-proactive-tick";

const now = Date.parse("2026-05-27T12:18:00.000Z");

function order(partial: Partial<AiGuestOrder> & { id: string }): AiGuestOrder {
  return {
    id: partial.id,
    status: partial.status ?? "preparing",
    created_at: partial.created_at ?? new Date(now - 18 * 60_000).toISOString(),
    delivered_at: partial.delivered_at ?? null,
    estimated_prep_minutes: partial.estimated_prep_minutes ?? null,
    prep_estimate_confidence: partial.prep_estimate_confidence ?? "none",
    order_items: partial.order_items ?? [
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

describe("kitchen delay triggers B1", () => {
  it("fires when wait exceeds ETA * 1.3", () => {
    const orders = [
      order({
        id: "o1",
        estimated_prep_minutes: 12,
        prep_estimate_confidence: "high",
        created_at: new Date(now - 18 * 60_000).toISOString(),
      }),
    ];

    expect(delayThresholdMinutes(orders[0]!)).toBe(16);
    expect(detectOrderDelayTrigger(orders, () => false, now)).not.toBeNull();
    expect(detectOrderEtaUpdateTrigger(orders, () => false, now)).not.toBeNull();
    expect(detectSlowKitchenTrigger(orders, () => false, now)).not.toBeNull();
  });

  it("does not fire when wait is below ETA threshold", () => {
    const orders = [
      order({
        id: "o1",
        estimated_prep_minutes: 12,
        created_at: new Date(now - 10 * 60_000).toISOString(),
      }),
    ];

    expect(detectOrderEtaUpdateTrigger(orders, () => false, now)).toBeNull();
  });

  it("falls back to 15 minutes when ETA is missing (1.5× threshold)", () => {
    const orders = [
      order({
        id: "o1",
        estimated_prep_minutes: null,
        created_at: new Date(now - 23 * 60_000).toISOString(),
      }),
    ];

    expect(
      detectOrderEtaUpdateTrigger(
        orders,
        () => false,
        now,
        DEFAULT_LATE_FALLBACK_MINUTES
      )
    ).not.toBeNull();
  });

  it("offers drink only when guest has no active drink order", () => {
    const orders = [
      order({
        id: "o1",
        estimated_prep_minutes: 12,
        created_at: new Date(now - 20 * 60_000).toISOString(),
      }),
      order({
        id: "o2",
        status: "accepted",
        created_at: new Date(now - 2 * 60_000).toISOString(),
        order_items: [
          {
            product_id: "pils-id",
            product_name: "Pils",
            unit_price: 4,
            quantity: 1,
            menu_section: "drinks",
          },
        ],
      }),
    ];

    expect(hasActiveDrinkOrder(orders)).toBe(true);
    const trigger = detectSlowKitchenTrigger(orders, () => false, now);
    expect(trigger?.prompt).toContain("do not suggest drinks");
    expect(
      buildSlowKitchenMessage({
        language: "sr",
        waitMinutes: 20,
        estimatedPrepMinutes: 12,
        prepEstimateConfidence: "high",
        delaySeverity: "significant",
        offerDrink: false,
      })
    ).not.toContain("popijete");
  });

  it("rank emits empathetic slow_kitchen message with drink offer", () => {
    const ranked = rankProactiveCandidates({
      config: cloneConciergePlatformDefaults(),
      orders: [
        order({
          id: "o1",
          estimated_prep_minutes: 12,
          prep_estimate_confidence: "high",
          created_at: new Date(now - 18 * 60_000).toISOString(),
        }),
      ],
      payload: {
        dismissedNudgeKeys: ["order_eta_update", "order_eta_update:o1"],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
      },
      messages: {
        browse: "Browse",
        dessert: "Dessert",
        slowKitchen: "fallback",
        guestWelcome: "Welcome",
        browseFollowUp: "Follow up",
        billPrompt: "Bill",
        orderDelay: "Delay",
        popularityPair: "Pair",
      },
      now,
    });

    expect(ranked[0]?.nudge.kind).toBe("slow_kitchen");
    expect(ranked[0]?.nudge.message).toContain("popijete");
    expect(ranked[0]?.nudge.message).toContain("~");
  });

  it("order_eta_update message includes remaining ETA", () => {
    const trigger = detectOrderEtaUpdateTrigger(
      [
        order({
          id: "o1",
          status: "preparing",
          estimated_prep_minutes: 12,
          created_at: new Date(now - 18 * 60_000).toISOString(),
        }),
      ],
      () => false,
      now
    );
    expect(trigger?.remainingEtaMinutes).toBeGreaterThan(0);
    expect(
      buildOrderDelayMessage({
        language: "sr",
        remainingEtaMinutes: trigger?.remainingEtaMinutes,
      })
    ).toContain("~");
  });

  it("detectOrderReadyTrigger fires for ready food order", () => {
    const trigger = detectOrderReadyNotifyTrigger(
      [
        order({
          id: "o-ready",
          status: "ready",
        }),
      ],
      () => false
    );
    expect(trigger?.kind).toBe("order_ready_notify");
    expect(trigger?.orderItemsLabel).toContain("Burger");
  });

  it("detectKitchenBusyTrigger fires before guest orders", () => {
    const trigger = detectKitchenBusyTrigger({
      hasSessionOrders: false,
      sessionPhase: "browsing",
      kitchenPendingCount: 10,
      estimatedWaitMinutes: 18,
      kdsStress: "high",
      isShown: () => false,
    });
    expect(trigger?.kind).toBe("kitchen_busy");
  });

  it("detectMultiTableDelayAlert requires three tables over 20 min", () => {
    expect(
      detectMultiTableDelayAlert([
        { tableId: "t1", tableName: "Sto 1", waitMinutes: 22 },
        { tableId: "t2", tableName: "Sto 2", waitMinutes: 25 },
      ])
    ).toBeNull();
    expect(
      detectMultiTableDelayAlert([
        { tableId: "t1", tableName: "Sto 1", waitMinutes: 22 },
        { tableId: "t2", tableName: "Sto 2", waitMinutes: 25 },
        { tableId: "t3", tableName: "Sto 3", waitMinutes: 28 },
      ])?.message
    ).toContain("3 stola");
  });

  it("estimateRemainingPrepMinutes shrinks as wait grows", () => {
    const sooner = order({
      id: "o1",
      estimated_prep_minutes: 12,
      created_at: new Date(now - 8 * 60_000).toISOString(),
    });
    const later = order({
      id: "o1",
      estimated_prep_minutes: 12,
      created_at: new Date(now - 11 * 60_000).toISOString(),
    });
    expect(estimateRemainingPrepMinutes(sooner, now)).toBeGreaterThan(
      estimateRemainingPrepMinutes(later, now)
    );
  });
});

describe("proactive tick B1", () => {
  it("returns order_eta_update when slow_kitchen is disabled but order delay is enabled", () => {
    const config = cloneConciergePlatformDefaults();
    config.proactive.slowKitchen = false;

    const result = evaluateGuestProactiveTick({
      config,
      orders: [
        order({
          id: "o1",
          estimated_prep_minutes: 12,
          created_at: new Date(now - 18 * 60_000).toISOString(),
        }),
      ],
      payload: {
        cartItemCount: 0,
        hasSessionOrders: true,
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
      },
      messages: {
        browse: "Browse",
        dessert: "Dessert",
        slowKitchen: "fallback",
        guestWelcome: "Welcome",
        browseFollowUp: "Follow up",
        billPrompt: "Bill",
        orderDelay: "Delay",
        popularityPair: "Pair",
      },
      now,
    });

    expect(result?.kind).toBe("order_eta_update");
    expect(result?.message).not.toBe("fallback");
  });
});

describe("decideProactiveTurnPlan SERVE", () => {
  it("does not suppress slow_kitchen during rush", () => {
    const state: TableSessionState = {
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
        cart: { ai: emptyCartState(), visibleLines: [] },
      },
      venue: {
        ops: {
          operatingMode: "rush",
          kdsStress: "high",
          acceptingOrders: true,
          unavailableProductIds: [],
          staffHint: null,
          stationStress: [],
        },
        opsEffects: {
          skipUpsell: true,
          shortenReplies: true,
          empathyNote: null,
          guestSafeStaffHint: null,
        },
      },
      conversation: {
        flowNodeId: "post_submit",
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
      config: cloneConciergePlatformDefaults(),
    };

    const beliefs = compileBeliefs({
      state,
      guestMessage: "",
    });

    const result = decideProactiveTurnPlan({
      beliefs,
      candidate: {
        kind: "slow_kitchen",
        message: buildSlowKitchenMessage({
          language: "sr",
          waitMinutes: 18,
          estimatedPrepMinutes: 12,
          prepEstimateConfidence: "high",
          delaySeverity: "significant",
          offerDrink: true,
        }),
      },
      sessionPhase: "waiting",
      config: cloneConciergePlatformDefaults(),
      cartLineCount: 0,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.suppressUpsell).toBe(false);
    }
    expect(getBeliefValue(beliefs, CORE_BELIEF_KEYS.venueSkipUpsell)).toBe(true);
  });
});
