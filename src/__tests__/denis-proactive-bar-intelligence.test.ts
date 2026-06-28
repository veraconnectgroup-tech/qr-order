import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import {
  detectDrinkRefillTrigger,
  detectDrinkWithFoodTrigger,
  detectHappyHourUpsellTrigger,
  detectRoundTwoTrigger,
} from "@/lib/denis/cognition/proactive/triggers";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

const now = Date.parse("2026-06-07T20:00:00.000Z");

function order(partial: Partial<AiGuestOrder> & { id: string }): AiGuestOrder {
  return {
    id: partial.id,
    status: partial.status ?? "preparing",
    created_at: partial.created_at ?? new Date(now - 2 * 60_000).toISOString(),
    delivered_at: partial.delivered_at ?? null,
    estimated_prep_minutes: partial.estimated_prep_minutes ?? null,
    prep_estimate_confidence: partial.prep_estimate_confidence ?? "none",
    order_items: partial.order_items ?? [
      {
        product_id: "schnitzel-id",
        product_name: "Schnitzel",
        unit_price: 14,
        quantity: 1,
        menu_section: "food",
      },
    ],
  };
}

function drinkOrder(
  id: string,
  deliveredMinutesAgo: number,
  orderMinutesAgo = 25
): AiGuestOrder {
  return order({
    id,
    status: "delivered",
    created_at: new Date(now - orderMinutesAgo * 60_000).toISOString(),
    delivered_at: new Date(now - deliveredMinutesAgo * 60_000).toISOString(),
    order_items: [
      {
        product_id: "pilsner-id",
        product_name: "Pilsner 0.5L",
        unit_price: 4,
        quantity: 1,
        menu_section: "drinks",
      },
    ],
  });
}

const rankMessages = {
  browse: "Browse",
  dessert: "Dessert",
  slowKitchen: "fallback",
  guestWelcome: "Welcome",
  browseFollowUp: "Follow up",
  billPrompt: "Bill",
  orderDelay: "Delay",
  popularityPair: "Pair",
};

describe("bar intelligence situation pack", () => {
  it("renders BAR block with active orders, last delivery, happy hour, suggestions", () => {
    const nowMs = Date.now();
    const pack = buildSituationPack({
      state: {
        table: { id: "t1", name: "T4", token: "tok" },
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
          orders: [
            {
              id: "d-open-1",
              status: "preparing",
              createdAt: new Date(nowMs - 5 * 60_000).toISOString(),
              items: [
                {
                  productName: "Pilsner 0.5L",
                  quantity: 1,
                  menuSection: "drinks",
                },
              ],
            },
            {
              id: "d-open-2",
              status: "accepted",
              createdAt: new Date(nowMs - 3 * 60_000).toISOString(),
              items: [
                {
                  productName: "Weizen 0.5L",
                  quantity: 1,
                  menuSection: "drinks",
                },
              ],
            },
            {
              id: "d-delivered",
              status: "delivered",
              createdAt: new Date(nowMs - 25 * 60_000).toISOString(),
              deliveredAt: new Date(nowMs - 22 * 60_000).toISOString(),
              items: [
                {
                  productName: "Pilsner 0.5L",
                  quantity: 1,
                  menuSection: "drinks",
                },
              ],
            },
          ],
          cart: { ai: emptyCartState(), visibleLines: [] },
        },
        timeline: [
          {
            event_type: "proactive.emitted",
            payload: { type: "proactive.emitted", kind: "drink_with_food" },
          },
        ],
        config: CONCIERGE_PLATFORM_DEFAULTS,
      } as never,
      beliefs: beliefGraph([]),
      sessionPhase: "waiting",
      venueSchedule: { happyHour: true, happyHourUntil: "19:00" },
    });

    expect(pack).toContain("BAR:");
    expect(pack).toContain("active_drink_orders: 2");
    expect(pack).toContain("last_drink_delivered:");
    expect(pack).toContain("Pilsner 0.5L");
    expect(pack).toContain("happy_hour: true (until 19:00)");
    expect(pack).toContain("drink_suggestions_made: 1");
  });
});

describe("bar intelligence proactive triggers", () => {
  it("drink delivered 25min ago with no new drink → drink_refill trigger", () => {
    const orders = [drinkOrder("d-refill", 18, 25)];

    const trigger = detectDrinkRefillTrigger(orders, {
      isShown: () => false,
      now,
    });

    expect(trigger?.kind).toBe("drink_refill");

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders,
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now,
    });

    expect(ranked.some((row) => row.nudge.kind === "drink_refill" || row.nudge.kind === "sommelier_refill")).toBe(true);
  });

  it("food without drink → drink_with_food trigger", () => {
    const orders = [
      order({
        id: "f1",
        status: "preparing",
        created_at: new Date(now - 60_000).toISOString(),
        order_items: [
          {
            product_id: "schnitzel-id",
            product_name: "Schnitzel",
            unit_price: 14,
            quantity: 1,
            menu_section: "food",
          },
        ],
      }),
    ];

    const trigger = detectDrinkWithFoodTrigger(
      orders,
      () => false,
      now,
      {
        vkgPairing: {
          foodName: "Schnitzel",
          drinkName: "Pilsner",
          serveSize: "0.5L",
        },
      }
    );

    expect(trigger?.kind).toBe("drink_with_food");

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders,
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
        vkgDrinkPairing: {
          foodName: "Schnitzel",
          drinkName: "Pilsner",
          serveSize: "0.5L",
        },
      },
      messages: rankMessages,
      now,
    });

    expect(
      ranked.some(
        (row) =>
          row.nudge.kind === "drink_with_food" ||
          row.nudge.kind === "sommelier_pairing"
      )
    ).toBe(true);
  });

  it("party 3 phones all delivered drinks → round_two trigger", () => {
    const orders = [
      drinkOrder("d-a", 20, 40),
      drinkOrder("d-b", 19, 38),
      drinkOrder("d-c", 18, 36),
    ];

    const trigger = detectRoundTwoTrigger({
      orders,
      partySize: 3,
      isShown: () => false,
      now,
    });
    expect(trigger?.kind).toBe("round_two");

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders,
      partyFacts: {
        partySize: 3,
        devicesWithOrder: 3,
        orderedRatio: 1,
        partyMode: "per_device",
        minutesSinceLastOrder: null,
        isPartyIncomplete: false,
        isPartyIncompleteForCurrentDevice: false,
        currentDeviceHasOrdered: true,
      },
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now,
    });

    expect(ranked.some((row) => row.nudge.kind === "round_two")).toBe(true);
  });

  it("happy hour active → happy_hour_upsell available", () => {
    const trigger = detectHappyHourUpsellTrigger({
      happyHourActive: true,
      sessionPhase: "browsing",
      isShown: () => false,
    });
    expect(trigger?.kind).toBe("happy_hour_upsell");

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "browsing",
        happyHourActive: true,
      },
      messages: rankMessages,
      now,
    });

    expect(ranked.some((row) => row.nudge.kind === "happy_hour_upsell")).toBe(true);
  });
});
