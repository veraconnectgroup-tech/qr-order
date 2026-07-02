import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { detectStaffProactiveAlerts } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import {
  buildTableTempoBrowseMessage,
  detectDrinksFinishedEstimate,
  detectTableTempoPhase,
  drinkConsumptionMinutes,
  shouldEmitTableTempoGuestNudge,
  shouldEscalateDrinksFinishedToWaiter,
  tableTempoDedupeKey,
} from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { OrderFact } from "@/lib/denis/loop/types";

const NOW = Date.parse("2026-07-01T20:00:00.000Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

const TEMPO = {
  ...CONCIERGE_PLATFORM_DEFAULTS.ops.tableTempo,
  enabled: true,
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

describe("detectTableTempoPhase (ADR-043 S8)", () => {
  it("returns none when table tempo is disabled", () => {
    expect(
      detectTableTempoPhase({
        sessionOpenedAt: minutesAgo(20),
        orders: [],
        guestMessageCount: 0,
        idleMinutes: 20,
        nowMs: NOW,
        config: { ...TEMPO, enabled: false },
      })
    ).toBe("none");
  });

  it("detects browsing_stalled when QR scan has no orders past threshold", () => {
    expect(
      detectTableTempoPhase({
        sessionOpenedAt: minutesAgo(12),
        orders: [],
        guestMessageCount: 0,
        idleMinutes: 12,
        nowMs: NOW,
        config: TEMPO,
      })
    ).toBe("browsing_stalled");
  });

  it("does not flag browsing_stalled below threshold", () => {
    expect(
      detectTableTempoPhase({
        sessionOpenedAt: minutesAgo(5),
        orders: [],
        guestMessageCount: 0,
        idleMinutes: 5,
        nowMs: NOW,
        config: TEMPO,
      })
    ).toBe("none");
  });

  it("detects drinks_finished_estimate from bar served_at + beer consumption heuristic", () => {
    const phase = detectTableTempoPhase({
      sessionOpenedAt: minutesAgo(40),
      orders: [
        {
          id: "order-beer",
          orderNumber: 2,
          status: "preparing",
          paymentStatus: "paid",
          estimatedPrepMinutes: null,
          createdAt: minutesAgo(35),
          items: [{ productName: "Pilsner 0.5L", quantity: 1, menuSection: "drinks" }],
          stationStates: [
            {
              station: "bar",
              status: "served",
              readyAt: minutesAgo(30),
              pickedUpAt: minutesAgo(28),
              servedAt: minutesAgo(25),
            },
          ],
        },
        foodOrder({
          stationStates: [
            {
              station: "kitchen",
              status: "in_prep",
              readyAt: null,
              pickedUpAt: null,
              servedAt: null,
            },
          ],
        }),
      ],
      guestMessageCount: 2,
      idleMinutes: 3,
      nowMs: NOW,
      config: TEMPO,
    });

    expect(phase).toBe("drinks_finished_estimate");
    expect(drinkConsumptionMinutes("Pilsner 0.5L", TEMPO)).toBe(20);
  });

  it("detects post_meal_idle after kitchen served and table goes quiet", () => {
    expect(
      detectTableTempoPhase({
        sessionOpenedAt: minutesAgo(90),
        orders: [foodOrder()],
        guestMessageCount: 4,
        idleMinutes: 18,
        nowMs: NOW,
        config: TEMPO,
      })
    ).toBe("post_meal_idle");
  });

  it("returns none when food served but idle is below post-meal threshold", () => {
    expect(
      detectTableTempoPhase({
        sessionOpenedAt: minutesAgo(60),
        orders: [foodOrder()],
        guestMessageCount: 2,
        idleMinutes: 8,
        nowMs: NOW,
        config: TEMPO,
      })
    ).toBe("none");
  });

  it("anti-spam: blocks duplicate tempo nudge in same phase", () => {
    const key = tableTempoDedupeKey("browsing_stalled");
    expect(
      shouldEmitTableTempoGuestNudge({
        phase: "browsing_stalled",
        emittedKeys: [key],
        dismissedKeys: [],
      })
    ).toBe(false);
    expect(
      shouldEmitTableTempoGuestNudge({
        phase: "browsing_stalled",
        emittedKeys: [],
        dismissedKeys: [],
      })
    ).toBe(true);
  });

  it("escalates to waiter when guest dismissed drinks tempo nudge", () => {
    expect(
      shouldEscalateDrinksFinishedToWaiter({
        emittedKeys: [],
        dismissedKeys: [tableTempoDedupeKey("drinks_finished_estimate")],
        guestIgnoredMinutes: 8,
        drinksNudgeEmittedAtMs: NOW - 10 * 60_000,
        nowMs: NOW,
        hasActiveDrinkOrder: false,
      })
    ).toBe(true);
  });

  it("does not re-nudge guest after drinks escalation path is active", () => {
    expect(
      shouldEscalateDrinksFinishedToWaiter({
        emittedKeys: [tableTempoDedupeKey("drinks_finished_estimate")],
        dismissedKeys: [],
        guestIgnoredMinutes: 8,
        drinksNudgeEmittedAtMs: NOW - 10 * 60_000,
        nowMs: NOW,
        hasActiveDrinkOrder: false,
      })
    ).toBe(true);
    expect(
      shouldEmitTableTempoGuestNudge({
        phase: "drinks_finished_estimate",
        emittedKeys: [tableTempoDedupeKey("drinks_finished_estimate")],
        dismissedKeys: [],
      })
    ).toBe(false);
  });

  it("detectDrinksFinishedEstimate respects grace minutes after consumption target", () => {
    expect(
      detectDrinksFinishedEstimate({
        orders: [
          {
            id: "order-beer",
            orderNumber: 3,
            status: "preparing",
            paymentStatus: "paid",
            estimatedPrepMinutes: null,
            createdAt: minutesAgo(30),
            items: [{ productName: "Espresso", quantity: 1, menuSection: "drinks" }],
            stationStates: [
              {
                station: "bar",
                status: "served",
                readyAt: minutesAgo(12),
                pickedUpAt: minutesAgo(11),
                servedAt: minutesAgo(23),
              },
            ],
          },
        ],
        config: TEMPO,
        nowMs: NOW,
      })
    ).toBe(true);
    expect(drinkConsumptionMinutes("Espresso", TEMPO)).toBe(20);
  });

  it("buildTableTempoBrowseMessage localizes help copy", () => {
    expect(buildTableTempoBrowseMessage("sr")).toContain("pomognem");
    expect(buildTableTempoBrowseMessage("en")).toContain("help");
  });
});

describe("table tempo integration (rank + staff)", () => {
  const messages = {
    browse: "Treba vam pomoć pri biranju?",
    dessert: "Spremni za desert?",
    slowKitchen: "Kuhinja radi intenzivno?",
    guestWelcome: "Dobrodošli!",
    browseFollowUp: "Da li ste odlučili?",
    billPrompt: "Hoćete račun?",
    orderDelay: "Stiže uskoro.",
    popularityPair: "Popularan par.",
  };

  it("ranks table_tempo_browse when browsing stalled", () => {
    const ranked = rankProactiveCandidates({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        ops: {
          ...CONCIERGE_PLATFORM_DEFAULTS.ops,
          tableTempo: { ...TEMPO, enabled: true },
        },
      },
      orders: [],
      payload: {
        tableTempoPhase: "browsing_stalled",
        dismissedNudgeKeys: [],
        hasSessionOrders: false,
        language: "sr",
      },
      messages,
      now: NOW,
    });

    expect(ranked.some((row) => row.nudge.kind === "table_tempo_browse")).toBe(
      true
    );
  });

  it("skips staff_table_idle when guest tempo owns browsing stall", () => {
    const alerts = detectStaffProactiveAlerts({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        ops: {
          ...CONCIERGE_PLATFORM_DEFAULTS.ops,
          tableTempo: { ...TEMPO, enabled: true },
        },
      },
      tableName: "7",
      idleMinutes: 20,
      hasSessionOrders: false,
      emittedKeys: [],
      recentGuestMessages: [],
      waiterEscalated: false,
      tableTempoPhase: "browsing_stalled",
    });

    expect(alerts.some((alert) => alert.kind === "staff_table_idle")).toBe(
      false
    );
  });

  it("routes ignored drinks tempo nudge to waiter staff alert", () => {
    const alerts = detectStaffProactiveAlerts({
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        ops: {
          ...CONCIERGE_PLATFORM_DEFAULTS.ops,
          tableTempo: { ...TEMPO, enabled: true },
        },
      },
      tableName: "3",
      idleMinutes: 5,
      emittedKeys: ["table_tempo:drinks_finished_estimate"],
      dismissedNudgeKeys: [],
      recentGuestMessages: [],
      waiterEscalated: false,
      tableTempoPhase: "drinks_finished_estimate",
      hasActiveDrinkOrder: false,
      drinksNudgeEmittedAtMs: NOW - 10 * 60_000,
      nowMs: NOW,
    });

    expect(alerts.some((alert) => alert.kind === "staff_drinks_finished")).toBe(
      true
    );
  });
});
