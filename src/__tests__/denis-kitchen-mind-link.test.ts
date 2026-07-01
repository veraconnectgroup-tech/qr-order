import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import {
  detectCookingGrillStartedTrigger,
  detectPreorderKitchenHeadsUp,
  detectStationBottleneckAvoidanceTrigger,
} from "@/lib/denis/cognition/proactive/kitchen-mind-triggers";
import { detectStaffProactiveAlerts } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import { assessWaiterObligation } from "@/lib/denis/cognition/waiter/assess-waiter-obligation";
import {
  formatPerItemPrepCommunication,
  locationPrepTimePriorsFromJson,
  emptyLocationPrepTimePriorsJson,
} from "@/lib/denis/config/prep-time-priors";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import {
  applyLiveStationLoadToForecast,
  forecastDemand,
} from "@/lib/denis/intelligence/demand-forecast";
import {
  buildKitchenLoadSnapshot,
  estimateParallelPrepMinutes,
  suggestBottleneckAlternative,
} from "@/lib/denis/venue/ops/kitchen-load-model";

const now = Date.parse("2026-06-07T20:00:00.000Z");

function grillOrder(id: string, productName = "Burger"): AiGuestOrder {
  return {
    id,
    status: "accepted",
    created_at: new Date(now - 5 * 60_000).toISOString(),
    delivered_at: null,
    estimated_prep_minutes: 12,
    prep_estimate_confidence: "high",
    order_items: [
      {
        product_id: "burger-id",
        product_name: productName,
        unit_price: 12,
        quantity: 1,
        menu_section: "food",
        food_tags: ["burger"],
      },
    ],
  };
}

describe("kitchen load model", () => {
  it("tracks per-station queue depth", () => {
    const load = buildKitchenLoadSnapshot([
      {
        status: "preparing",
        order_items: [
          { product_name: "Burger", menu_section: "food", food_tags: ["burger"] },
          { product_name: "Burger", menu_section: "food", food_tags: ["burger"] },
          { product_name: "Burger", menu_section: "food", food_tags: ["burger"] },
          { product_name: "Pomfrit", menu_section: "food", food_tags: ["fries", "side"] },
          { product_name: "Ceasar salata", menu_section: "food", food_tags: ["salad"] },
        ],
      },
    ]);

    expect(load.stations.find((row) => row.station === "grill")?.queueDepth).toBe(
      3
    );
    expect(load.stations.find((row) => row.station === "fryer")?.queueDepth).toBe(
      1
    );
    expect(load.stations.find((row) => row.station === "salad")?.queueDepth).toBe(
      1
    );
  });

  it("uses max not sum for parallel prep (Burger 12 + Salad 4 = 12)", () => {
    const prepTime = emptyLocationPrepTimePriorsJson();
    prepTime.byProduct["burger-id"] = {
      productId: "burger-id",
      p50Minutes: 12,
      p90Minutes: 16,
      sampleCount: 10,
      rushMultiplier: 1.4,
    };
    prepTime.byProduct["salad-id"] = {
      productId: "salad-id",
      p50Minutes: 4,
      p90Minutes: 6,
      sampleCount: 10,
      rushMultiplier: 1.2,
    };
    const priors = locationPrepTimePriorsFromJson(prepTime);

    const estimate = estimateParallelPrepMinutes({
      items: [
        { productId: "burger-id", productName: "Burger", menuSection: "food" },
        { productId: "salad-id", productName: "Salata", menuSection: "food" },
      ],
      priors,
    });

    expect(estimate.totalMinutes).toBe(12);
    expect(estimate.perItem.map((row) => row.etaMinutes)).toEqual([12, 4]);
  });

  it("suggests alternative when grill is full and guest orders burger", () => {
    const load = buildKitchenLoadSnapshot(
      Array.from({ length: 5 }, (_, index) => ({
        status: "preparing",
        order_items: [
          {
            product_name: "Burger",
            menu_section: "food",
            product_id: `b-${index}`,
            food_tags: ["burger"],
          },
        ],
      }))
    );

    const suggestion = suggestBottleneckAlternative({
      productName: "Burger",
      productId: "burger-id",
      menuSection: "food",
      foodTags: ["burger"],
      load,
    });

    expect(suggestion).not.toBeNull();
    expect(suggestion?.alternativeName).toBe("Pečeno pile");
    expect(suggestion?.overloadedStation).toBe("grill");
    expect(suggestion?.queueDepth).toBe(5);
  });
});

describe("per-item prep communication", () => {
  it("formats Burger + Salad with arrives-sooner copy", () => {
    const copy = formatPerItemPrepCommunication({
      perItem: [
        { productName: "Burger", etaMinutes: 12 },
        { productName: "Salata", etaMinutes: 4 },
      ],
      language: "sr",
    });

    expect(copy).toContain("Burger: oko 12 minuta");
    expect(copy).toContain("Salata stiže pre toga");
  });
});

describe("waiter obligation prep time", () => {
  it("includes per-item prep communication in obligation", () => {
    const obligation = assessWaiterObligation({
      cartLines: [
        {
          productId: "burger-id",
          productName: "Burger",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 12,
          menuSection: "food",
        },
        {
          productId: "salad-id",
          productName: "Salata",
          quantity: 1,
          serveSize: null,
          modifierIds: [],
          notes: "",
          lineTotal: 6,
          menuSection: "food",
        },
      ],
      pendingSlot: null,
      language: "sr",
      prepTimePriorsJson: {
        version: 1,
        byProduct: {
          "burger-id": {
            productId: "burger-id",
            p50Minutes: 12,
            p90Minutes: 16,
            sampleCount: 10,
            rushMultiplier: 1.4,
          },
          "salad-id": {
            productId: "salad-id",
            p50Minutes: 4,
            p90Minutes: 6,
            sampleCount: 10,
            rushMultiplier: 1.2,
          },
        },
        byStation: {},
        updatedAt: new Date().toISOString(),
      },
    });

    expect(obligation.prepTimeCommunication).toContain("Burger: oko 12 minuta");
    expect(obligation.prepTimeCommunication).toContain("Salata stiže pre toga");
  });
});

describe("pre-order kitchen heads-up", () => {
  it("notifies kitchen for large party browsing 10+ minutes", () => {
    const trigger = detectPreorderKitchenHeadsUp({
      browseMinutes: 12,
      partySize: 6,
      hasSessionOrders: false,
      sessionPhase: "browsing",
      tableName: "Sto 5",
      isShown: () => false,
    });

    expect(trigger?.kind).toBe("preorder_kitchen_heads_up");
    expect(trigger?.prompt).toContain("Sto 5");
    expect(trigger?.prompt).toContain("6 osoba");

    const alerts = detectStaffProactiveAlerts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      tableName: "Sto 5",
      idleMinutes: 12,
      hasSessionOrders: false,
      emittedKeys: [],
      recentGuestMessages: [],
      waiterEscalated: false,
      browseMinutes: 12,
      partySize: 6,
    });

    expect(alerts.some((alert) => alert.kind === "staff_preorder_heads_up")).toBe(
      true
    );
  });
});

describe("proactive kitchen mind nudges", () => {
  it("suggests bottleneck alternative when grill full + burger in cart", () => {
    const venueOrders = Array.from({ length: 5 }, (_, index) =>
      grillOrder(`venue-${index}`)
    );

    const trigger = detectStationBottleneckAvoidanceTrigger({
      cartItems: [
        {
          productId: "burger-id",
          productName: "Burger",
          menuSection: "food",
          foodTags: ["burger"],
        },
      ],
      venueOrders,
      sessionPhase: "ordering",
      isShown: () => false,
    });

    expect(trigger?.kind).toBe("station_bottleneck_avoid");
    expect(trigger?.alternativeName).toBe("Pečeno pile");

    const ranked = rankProactiveCandidates({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      orders: [],
      venueKitchenOrders: venueOrders,
      cartItems: [
        {
          productId: "burger-id",
          productName: "Burger",
          menuSection: "food",
          foodTags: ["burger"],
        },
      ],
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "ordering",
        hasSessionOrders: false,
        hasFoodInCart: true,
        cartItemCount: 1,
      },
      messages: {
        browse: "",
        dessert: "",
        slowKitchen: "",
        guestWelcome: "",
        browseFollowUp: "",
        billPrompt: "",
        orderDelay: "",
        popularityPair: "",
      },
      now,
    });

    expect(
      ranked.some((row) => row.nudge.kind === "station_bottleneck_avoid")
    ).toBe(true);
  });

  it("pushes grill-started when order enters preparing", () => {
    const trigger = detectCookingGrillStartedTrigger(
      [
        {
          ...grillOrder("o-grill"),
          status: "preparing",
          preparing_at: new Date(now - 60_000).toISOString(),
        } as AiGuestOrder & { preparing_at: string },
      ],
      () => false,
      now
    );

    expect(trigger?.kind).toBe("cooking_grill_started");
  });
});

describe("situation pack kitchen pulse", () => {
  it("includes kitchen_pulse and bottleneck redirect in pack", () => {
    const venueKitchenOrders = Array.from({ length: 5 }, (_, index) => ({
      id: `v-${index}`,
      status: "preparing",
      createdAt: new Date(now - 5 * 60_000).toISOString(),
      items: [
        {
          productId: `b-${index}`,
          productName: "Burger",
          quantity: 1,
          menuSection: "food",
          foodTags: ["burger"],
        },
      ],
    }));

    const pack = buildSituationPack({
      state: {
        table: { id: "t1", name: "T5", token: "tok" },
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
            ai: {
              ...emptyCartState(),
              draft: {
                cartRevision: 1,
                items: [
                  {
                    productId: "burger-id",
                    productName: "Burger",
                    quantity: 1,
                    serveSize: null,
                    modifierIds: [],
                    notes: "",
                    lineTotal: 12,
                    menuSection: "food",
                    foodTags: ["burger"],
                  },
                ],
              },
            },
            visibleLines: [
              {
                productId: "burger-id",
                productName: "Burger",
                quantity: 1,
                serveSize: null,
                modifierIds: [],
                notes: "",
                lineTotal: 12,
                menuSection: "food",
                foodTags: ["burger"],
              },
            ],
          },
        },
        config: CONCIERGE_PLATFORM_DEFAULTS,
      } as never,
      beliefs: beliefGraph([]),
      sessionPhase: "ordering",
      venueKitchenOrders,
    });

    expect(pack).toContain("kitchen_pulse:");
    expect(pack).toContain("grill(5)");
    expect(pack).toContain("bottleneck_redirect");
    expect(pack).toContain("Pečeno pile");
  });
});

describe("demand forecast live station load", () => {
  it("downshifts grill items when grill is in rush", () => {
    const forecast = forecastDemand({
      historicalOrders: Array.from({ length: 40 }, (_, index) => ({
        productId: "burger-id",
        productName: "Burger",
        quantity: 2,
        createdAt: new Date(Date.UTC(2026, 4, 27 + (index % 7), 19, 0)).toISOString(),
      })),
      dayOfWeek: 2,
      minHistoryDays: 5,
    });

    const adjusted = applyLiveStationLoadToForecast(forecast, {
      stations: [
        { station: "grill", queueDepth: 6, rushMode: true },
        { station: "fryer", queueDepth: 1, rushMode: false },
        { station: "salad", queueDepth: 0, rushMode: false },
      ],
    });

    const before = forecast.slots.flatMap((slot) => slot.predictions);
    const after = adjusted.slots.flatMap((slot) => slot.predictions);
    const burgerBefore = before.find((row) => row.productName === "Burger");
    const burgerAfter = after.find((row) => row.productName === "Burger");

    expect(burgerBefore).toBeDefined();
    expect(burgerAfter).toBeDefined();
    expect(burgerAfter!.expectedQuantity).toBeLessThan(burgerBefore!.expectedQuantity);
    expect(burgerAfter!.factors).toContain("live_station_rush_downshift");
  });
});
