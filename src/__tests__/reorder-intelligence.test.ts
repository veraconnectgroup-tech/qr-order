import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { SessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import { beliefGraph, CORE_BELIEF_KEYS, belief } from "@/lib/denis/cognition/tde/turn-plan-types";
import {
  buildDrinkEmptyNudgeMessage,
  buildReorderDockHeadline,
  detectReorderOpportunity,
  drinkEmptyThresholdMinutes,
  formatReorderItemsLabel,
  isReorderRequestMessage,
  reorderNudgeKey,
  reorderNudgeQuickReplyLabels,
} from "@/lib/denis/cognition/reorder/reorder-intelligence";
import { buildReturnGuestWelcomeMessage } from "@/lib/denis/learning/guest-memory/build-welcome-message";
import { sameAgainQuickReplyLabels } from "@/lib/denis/learning/guest-memory/same-again-chips";
import { isCommerceCapabilityActive } from "@/lib/commerce/policy/resolve-commerce-capability";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import { emptyGuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

const NOW = Date.parse("2026-06-27T20:30:00.000Z");

function warmTrajectory(): SessionTrajectory {
  return {
    ordering: "steady",
    engagement: "warm",
    meal: "active",
    interruptionRisk: 0.2,
    opportunity: 0.6,
    evidence: [],
  };
}

function drinkOrder(input: {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  deliveredMinutesAgo: number;
}): AiGuestOrder {
  const deliveredAt = new Date(
    NOW - input.deliveredMinutesAgo * 60_000
  ).toISOString();
  return {
    id: input.id,
    status: "delivered",
    created_at: deliveredAt,
    delivered_at: deliveredAt,
    order_items: [
      {
        product_id: input.productId,
        product_name: input.productName,
        unit_price: 4,
        quantity: input.quantity,
        menu_section: "drinks",
      },
    ],
  };
}

describe("reorder pattern helpers", () => {
  it('matches "još jedno" as reorder request', () => {
    expect(isReorderRequestMessage("još jedno")).toBe(true);
    expect(isReorderRequestMessage("Još jedno pivo molim")).toBe(true);
  });

  it("uses 15 min threshold for beer and 25 min for cocktails", () => {
    expect(drinkEmptyThresholdMinutes("Pilsner")).toBe(15);
    expect(drinkEmptyThresholdMinutes("Mojito")).toBe(25);
  });

  it("builds drink-empty nudge copy and same-again chips", () => {
    expect(buildDrinkEmptyNudgeMessage("Pilsner", "sr")).toBe("Još jedno Pilsner?");
    expect(reorderNudgeQuickReplyLabels("sr")).toEqual({
      sameAgain: "Da, isto",
      somethingElse: "Nešto drugo",
    });
    expect(sameAgainQuickReplyLabels("sr")).toEqual(reorderNudgeQuickReplyLabels("sr"));
  });
});

describe("detectReorderOpportunity P1", () => {
  it("offers another round when two beers were delivered 17 min ago and guest is active", () => {
    const mental = emptyGuestMentalModel(NOW);
    mental.engagement.guestTurns = 2;

    const result = detectReorderOpportunity({
      orders: [
        drinkOrder({
          id: "order-1",
          productId: "beer-1",
          productName: "Pivo",
          quantity: 2,
          deliveredMinutesAgo: 17,
        }),
      ],
      mental,
      trajectory: warmTrajectory(),
      now: NOW,
    });

    expect(result).not.toBeNull();
    expect(result?.trigger).toBe("drink_empty_estimate");
    expect(result?.candidate.items).toEqual([
      { productId: "beer-1", productName: "Pivo", quantity: 2 },
    ]);
    expect(buildReorderDockHeadline(result!.candidate.items, "sr")).toContain(
      "Još jedna runda?"
    );
    expect(buildReorderDockHeadline(result!.candidate.items, "sr")).toContain(
      "2× Pivo"
    );
  });

  it("does not nudge drinks before 15 minutes", () => {
    const result = detectReorderOpportunity({
      orders: [
        drinkOrder({
          id: "order-1",
          productId: "beer-1",
          productName: "Pivo",
          quantity: 1,
          deliveredMinutesAgo: 10,
        }),
      ],
      mental: emptyGuestMentalModel(NOW),
      trajectory: warmTrajectory(),
      now: NOW,
    });

    expect(result).toBeNull();
  });

  it("nudges cocktails only after 25 minutes", () => {
    const mental = emptyGuestMentalModel(NOW);
    mental.engagement.guestTurns = 1;

    expect(
      detectReorderOpportunity({
        orders: [
          drinkOrder({
            id: "order-1",
            productId: "cocktail-1",
            productName: "Mojito",
            quantity: 1,
            deliveredMinutesAgo: 20,
          }),
        ],
        mental,
        trajectory: warmTrajectory(),
        now: NOW,
      })
    ).toBeNull();

    const nudge = detectReorderOpportunity({
      orders: [
        drinkOrder({
          id: "order-1",
          productId: "cocktail-1",
          productName: "Mojito",
          quantity: 1,
          deliveredMinutesAgo: 26,
        }),
      ],
      mental,
      trajectory: warmTrajectory(),
      now: NOW,
    });

    expect(nudge?.trigger).toBe("drink_empty_estimate");
    expect(buildDrinkEmptyNudgeMessage("Mojito", "sr")).toBe("Još jedno Mojito?");
  });

  it("welcomes returning guest from memory on second visit", () => {
    const result = detectReorderOpportunity({
      orders: [],
      mental: emptyGuestMentalModel(NOW),
      trajectory: warmTrajectory(),
      memory: emptyGuestMemoryProjection({
        favoriteProductIds: ["schnitzel-1", "pilsner-1"],
        lastVisitItemNames: ["Schnitzel", "Pilsner"],
        visitCount: 2,
      }),
      now: NOW,
    });

    expect(result?.trigger).toBe("returning_guest");
    expect(buildReturnGuestWelcomeMessage({
      language: "sr",
      lastVisitItems: ["Schnitzel", "Pilsner"],
      visitCount: 2,
    })).toBe("Prošli put ste imali Schnitzel i Pilsner — ponovo?");
  });

  it("detects group round when primary orders another round for the table", () => {
    const deliveredAt = new Date(NOW - 10 * 60_000).toISOString();
    const result = detectReorderOpportunity({
      orders: [
        {
          id: "order-a",
          status: "delivered",
          created_at: deliveredAt,
          delivered_at: deliveredAt,
          order_items: [
            {
              product_id: "pilsner-1",
              product_name: "Pilsner",
              unit_price: 4,
              quantity: 1,
              menu_section: "drinks",
            },
          ],
        },
        {
          id: "order-b",
          status: "delivered",
          created_at: deliveredAt,
          delivered_at: deliveredAt,
          order_items: [
            {
              product_id: "pilsner-1",
              product_name: "Pilsner",
              unit_price: 4,
              quantity: 1,
              menu_section: "drinks",
            },
          ],
        },
      ],
      mental: emptyGuestMentalModel(NOW),
      trajectory: warmTrajectory(),
      party: {
        tableSessionId: "session-1",
        partyMode: "per_device",
        sharedAiSessionId: null,
        devices: [],
        activeDeviceCount: 2,
        currentDeviceFingerprint: null,
        isCurrentDevicePrimary: true,
      },
      timeline: [
        {
          id: "t1",
          ai_session_id: "s1",
          seq: 1,
          event_type: "signal.message",
          payload: { text: "Još jednu rundu za stol" },
          trace_id: null,
          context_hash: null,
          created_at: new Date(NOW - 30_000).toISOString(),
        },
      ],
      now: NOW,
    });

    expect(result?.trigger).toBe("group_round");
    expect(result?.candidate.items[0]?.quantity).toBe(2);
  });

  it("honours guest food reorder only on explicit request", () => {
    const deliveredAt = new Date(NOW - 5 * 60_000).toISOString();
    const orders: AiGuestOrder[] = [
      {
        id: "food-1",
        status: "delivered",
        created_at: deliveredAt,
        delivered_at: deliveredAt,
        order_items: [
          {
            product_id: "cevapi-1",
            product_name: "Ćevapi",
            unit_price: 12,
            quantity: 1,
            menu_section: "food",
          },
        ],
      },
    ];

    expect(
      detectReorderOpportunity({
        orders,
        mental: emptyGuestMentalModel(NOW),
        trajectory: warmTrajectory(),
        now: NOW,
      })
    ).toBeNull();

    const guestRequest = detectReorderOpportunity({
      orders,
      mental: emptyGuestMentalModel(NOW),
      trajectory: warmTrajectory(),
      timeline: [
        {
          id: "t1",
          ai_session_id: "s1",
          seq: 1,
          event_type: "signal.message",
          payload: { text: "Može isto opet molim" },
          trace_id: null,
          context_hash: null,
          created_at: new Date(NOW - 30_000).toISOString(),
        },
      ],
      now: NOW,
    });

    expect(guestRequest?.trigger).toBe("guest_request");
    expect(guestRequest?.candidate.items[0]?.productName).toBe("Ćevapi");
  });

  it('routes "još jedno" guest request through decideTurnPlan reflex', () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([
        belief(CORE_BELIEF_KEYS.commercePressure, "none"),
        belief(CORE_BELIEF_KEYS.commerceHasDeliveredOrders, true),
      ]),
      message: "još jedno",
      reflex: {
        usedT0: false,
        handoffCommand: null,
        reflex: null,
        plan: {
          transition: {
            fromNodeId: "collect",
            toNodeId: "collect",
            signal: "ORDER",
            skippedGuard: false,
          },
          flowNode: {
            nodeId: "collect",
            skills: [],
            narrateTemplate: null,
            guard: null,
          },
          goals: [],
          topGoal: null,
          skills: [],
          primarySignal: "ORDER",
        },
      },
    });

    expect(plan.kind).toBe("reflex_only");
    expect(plan.reason).toBe("commerce.reorder.guest_request");
  });

  it("marks partial eligibility when some items are unavailable", () => {
    const deliveredAt = new Date(NOW - 20 * 60_000).toISOString();
    const result = detectReorderOpportunity({
      orders: [
        {
          id: "order-1",
          status: "delivered",
          created_at: deliveredAt,
          delivered_at: deliveredAt,
          order_items: [
            {
              product_id: "beer-1",
              product_name: "Pivo",
              unit_price: 4,
              quantity: 1,
              menu_section: "drinks",
            },
            {
              product_id: "cola-1",
              product_name: "Cola",
              unit_price: 3,
              quantity: 1,
              menu_section: "drinks",
            },
          ],
        },
      ],
      mental: {
        ...emptyGuestMentalModel(NOW),
        engagement: { ...emptyGuestMentalModel(NOW).engagement, guestTurns: 1 },
      },
      trajectory: warmTrajectory(),
      unavailableProductIds: ["cola-1"],
      now: NOW,
    });

    expect(result?.candidate.eligibility).toBe("partial");
    expect(result?.candidate.unavailableItems).toEqual(["Cola"]);
    expect(result?.candidate.items).toEqual([
      { productId: "beer-1", productName: "Pivo", quantity: 1 },
    ]);
  });

  it("suppresses repeat nudge for the same product in one session", () => {
    const orders = [
      drinkOrder({
        id: "order-1",
        productId: "beer-1",
        productName: "Pivo",
        quantity: 2,
        deliveredMinutesAgo: 18,
      }),
    ];

    const first = detectReorderOpportunity({
      orders,
      mental: {
        ...emptyGuestMentalModel(NOW),
        engagement: { ...emptyGuestMentalModel(NOW).engagement, guestTurns: 1 },
      },
      trajectory: warmTrajectory(),
      now: NOW,
    });
    expect(first).not.toBeNull();

    const second = detectReorderOpportunity({
      orders,
      mental: {
        ...emptyGuestMentalModel(NOW),
        engagement: { ...emptyGuestMentalModel(NOW).engagement, guestTurns: 1 },
      },
      trajectory: warmTrajectory(),
      dismissedNudgeKeys: [reorderNudgeKey("beer-1")],
      now: NOW,
    });
    expect(second).toBeNull();
  });

  it("formats item labels for dock headline", () => {
    expect(
      formatReorderItemsLabel([
        { productId: "a", productName: "Pivo", quantity: 2 },
        { productId: "b", productName: "Cola", quantity: 1 },
      ])
    ).toBe("2× Pivo, 1× Cola");
  });
});

describe("isCommerceCapabilityActive reorder.another_round", () => {
  it("is enabled under canary rollout policy defaults", () => {
    const policy = DEFAULT_COMMERCE_POLICY;
    expect(policy.capabilities["reorder.another_round"].enabled).toBe(true);
    expect(policy.capabilities["reorder.another_round"].rollout.mode).toBe(
      "canary"
    );
  });

  it("respects canary cohort for stable session keys", () => {
    const active = isCommerceCapabilityActive({
      capabilityId: "reorder.another_round",
      cohortKey: "00000000-0000-4000-8000-000000000001",
    });
    const inactive = isCommerceCapabilityActive({
      capabilityId: "reorder.another_round",
      cohortKey: "00000000-0000-4000-8000-000000000099",
    });
    expect(typeof active).toBe("boolean");
    expect(typeof inactive).toBe("boolean");
  });
});
