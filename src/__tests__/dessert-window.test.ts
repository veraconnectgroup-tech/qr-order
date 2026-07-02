import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  aggregateDessertWindowStats,
} from "@/lib/admin/denis-shift-report";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import {
  COFFEE_AFTER_DESSERT_DEDUPE_KEY,
  DESSERT_WINDOW_DEDUPE_KEY,
  detectDessertWindow,
  detectPostMealChainStep,
  hasStationProblemsBlockingUpsell,
  isCoffeeUpsellChainBlocked,
  isDessertUpsellChainBlocked,
} from "@/lib/denis/cognition/tempo/detect-dessert-window";
import type { OrderFact } from "@/lib/denis/loop/types";

const NOW = Date.parse("2026-07-01T20:00:00.000Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

const DESSERT_WINDOW = {
  ...CONCIERGE_PLATFORM_DEFAULTS.ops.dessertWindow,
  enabled: true,
  mainCourseConsumptionMinutes: 18,
  graceMinutes: 2,
  windowMaxMinutes: 12,
};

function foodOrder(overrides: Partial<OrderFact> = {}): OrderFact {
  return {
    id: "order-food",
    orderNumber: 1,
    status: "preparing",
    paymentStatus: "paid",
    estimatedPrepMinutes: 15,
    createdAt: minutesAgo(40),
    items: [{ productName: "Ćevapi", quantity: 1, menuSection: "food" }],
    stationStates: [
      {
        station: "kitchen",
        status: "served",
        readyAt: minutesAgo(25),
        pickedUpAt: minutesAgo(24),
        servedAt: minutesAgo(20),
      },
    ],
    ...overrides,
  };
}

describe("detectDessertWindow (ADR-043 S10)", () => {
  it("returns none when disabled", () => {
    expect(
      detectDessertWindow({
        orders: [foodOrder()],
        config: { ...DESSERT_WINDOW, enabled: false },
        nowMs: NOW,
      }).phase
    ).toBe("none");
  });

  it("returns none for bar-only order (no kitchen food)", () => {
    expect(
      detectDessertWindow({
        orders: [
          {
            ...foodOrder(),
            items: [{ productName: "Pivo", quantity: 1, menuSection: "drinks" }],
            stationStates: [
              {
                station: "bar",
                status: "served",
                readyAt: minutesAgo(10),
                pickedUpAt: minutesAgo(9),
                servedAt: minutesAgo(8),
              },
            ],
          },
        ],
        config: DESSERT_WINDOW,
        nowMs: NOW,
      }).phase
    ).toBe("none");
  });

  it("returns before_window when kitchen served but consumption not elapsed", () => {
    const result = detectDessertWindow({
      orders: [
        foodOrder({
          stationStates: [
            {
              station: "kitchen",
              status: "served",
              readyAt: minutesAgo(10),
              pickedUpAt: minutesAgo(9),
              servedAt: minutesAgo(10),
            },
          ],
        }),
      ],
      config: DESSERT_WINDOW,
      nowMs: NOW,
    });
    expect(result.phase).toBe("before_window");
  });

  it("returns in_window when kitchen served past consumption + grace", () => {
    const result = detectDessertWindow({
      orders: [foodOrder()],
      config: DESSERT_WINDOW,
      nowMs: NOW,
    });
    expect(result.phase).toBe("in_window");
    expect(result.orderId).toBe("order-food");
  });

  it("returns after_window when guest already has dessert", () => {
    expect(
      detectDessertWindow({
        orders: [
          foodOrder(),
          {
            id: "order-dessert",
            orderNumber: 2,
            status: "preparing",
            paymentStatus: "paid",
            estimatedPrepMinutes: 5,
            createdAt: minutesAgo(5),
            items: [
              { productName: "Tiramisu", quantity: 1, menuSection: "desserts" },
            ],
          },
        ],
        config: DESSERT_WINDOW,
        nowMs: NOW,
      }).phase
    ).toBe("after_window");
  });

  it("returns after_window when window max exceeded", () => {
    expect(
      detectDessertWindow({
        orders: [
          foodOrder({
            stationStates: [
              {
                station: "kitchen",
                status: "served",
                readyAt: minutesAgo(60),
                pickedUpAt: minutesAgo(59),
                servedAt: minutesAgo(55),
              },
            ],
          }),
        ],
        config: DESSERT_WINDOW,
        nowMs: NOW,
      }).phase
    ).toBe("after_window");
  });
});

describe("station problem upsell gate (S10)", () => {
  it("blocks upsell when open station question trigger exists", () => {
    const blocked = hasStationProblemsBlockingUpsell({
      orders: [
        foodOrder({
          status: "pending",
          createdAt: minutesAgo(5),
          stationStates: [
            {
              station: "kitchen",
              status: "queued",
              readyAt: null,
              pickedUpAt: null,
              servedAt: null,
            },
          ],
        }),
      ],
      stationQuestions: {
        ...CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions,
        enabled: true,
        pendingAcceptMinutes: 2,
      },
      nowMs: NOW,
    });
    expect(blocked).toBe(true);
  });
});

describe("post-meal chain (S10)", () => {
  it("declined dessert stops coffee chain", () => {
    expect(isDessertUpsellChainBlocked(["dessert_nudge"])).toBe(true);
    expect(isCoffeeUpsellChainBlocked(["dessert_nudge"])).toBe(true);
    expect(
      detectPostMealChainStep({
        orders: [
          foodOrder(),
          {
            id: "order-dessert",
            orderNumber: 2,
            status: "preparing",
            paymentStatus: "paid",
            estimatedPrepMinutes: 5,
            createdAt: minutesAgo(3),
            items: [
              { productName: "Tiramisu", quantity: 1, menuSection: "desserts" },
            ],
          },
        ],
        config: DESSERT_WINDOW,
        dismissedKeys: ["dessert_nudge"],
        nowMs: NOW,
      })
    ).toBe("none");
  });

  it("offers coffee after dessert without declined dessert", () => {
    expect(
      detectPostMealChainStep({
        orders: [
          foodOrder(),
          {
            id: "order-dessert",
            orderNumber: 2,
            status: "preparing",
            paymentStatus: "paid",
            estimatedPrepMinutes: 5,
            createdAt: minutesAgo(3),
            items: [
              { productName: "Tiramisu", quantity: 1, menuSection: "desserts" },
            ],
          },
        ],
        config: DESSERT_WINDOW,
        dismissedKeys: [],
        nowMs: NOW,
      })
    ).toBe("coffee");
  });
});

describe("rankProactiveCandidates dessert window integration", () => {
  const baseConfig = {
    proactive: CONCIERGE_PLATFORM_DEFAULTS.proactive,
    upsell: CONCIERGE_PLATFORM_DEFAULTS.upsell,
    mentalModel: CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
    handoff: CONCIERGE_PLATFORM_DEFAULTS.handoff,
    ops: {
      ...CONCIERGE_PLATFORM_DEFAULTS.ops,
      dessertWindow: DESSERT_WINDOW,
      stationQuestions: {
        ...CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions,
        enabled: true,
        foodSlaMinutes: 12,
      },
    },
  };

  it("emits dessert_nudge in station window", () => {
    const candidates = rankProactiveCandidates({
      config: baseConfig,
      orders: [],
      orderFacts: [foodOrder()],
      payload: {
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
        dessertProductName: "Tiramisu",
      },
      messages: {
        browse: "",
        dessert: "Hoćete desert?",
        slowKitchen: "",
        guestWelcome: "",
        browseFollowUp: "",
        billPrompt: "",
        orderDelay: "",
        popularityPair: "",
      },
      now: NOW,
    });

    expect(
      candidates.some((row) => row.nudge.kind === "dessert_nudge")
    ).toBe(true);
  });

  it("does not emit dessert_nudge when station problem blocks upsell", () => {
    const candidates = rankProactiveCandidates({
      config: baseConfig,
      orders: [],
      orderFacts: [
        foodOrder({
          status: "pending",
          createdAt: minutesAgo(5),
          stationStates: [
            {
              station: "kitchen",
              status: "queued",
              readyAt: null,
              pickedUpAt: null,
              servedAt: null,
            },
          ],
        }),
      ],
      payload: {
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
        dessertProductName: "Tiramisu",
      },
      messages: {
        browse: "",
        dessert: "Hoćete desert?",
        slowKitchen: "",
        guestWelcome: "",
        browseFollowUp: "",
        billPrompt: "",
        orderDelay: "",
        popularityPair: "",
      },
      now: NOW,
    });

    expect(
      candidates.some((row) => row.nudge.kind === "dessert_nudge")
    ).toBe(false);
  });

  it("emits coffee_nudge after dessert without declined chain", () => {
    const candidates = rankProactiveCandidates({
      config: baseConfig,
      orders: [],
      orderFacts: [
        foodOrder(),
        {
          id: "order-dessert",
          orderNumber: 2,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: 5,
          createdAt: minutesAgo(3),
          items: [
            { productName: "Tiramisu", quantity: 1, menuSection: "desserts" },
          ],
        },
      ],
      payload: {
        dismissedNudgeKeys: [],
        hasSessionOrders: true,
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
      now: NOW,
    });

    expect(candidates.some((row) => row.nudge.kind === "coffee_nudge")).toBe(
      true
    );
  });
});

describe("aggregateDessertWindowStats (daily report S10)", () => {
  it("aggregates proposed/accepted/declined from rollup maps", () => {
    const stats = aggregateDessertWindowStats({
      byNudgeKind: { dessert_nudge: 5, coffee_nudge: 2 },
      byOutcome: { accepted: 3, declined: 2 },
      valueEuros: 4500,
    });
    expect(stats.proposed).toBe(7);
    expect(stats.accepted).toBe(3);
    expect(stats.declined).toBe(2);
    expect(stats.valueEuros).toBe(4500);
  });
});

describe("dedupe keys (anticipation.resolved loop)", () => {
  it("uses stable dessert window dedupe keys", () => {
    expect(DESSERT_WINDOW_DEDUPE_KEY).toBe("dessert_window");
    expect(COFFEE_AFTER_DESSERT_DEDUPE_KEY).toBe("coffee_nudge");
  });
});
