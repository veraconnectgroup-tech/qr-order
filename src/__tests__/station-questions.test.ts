import { describe, expect, it } from "vitest";
import {
  buildStationQuestionMessage,
  evaluateStationQuestionTriggers,
  stationForOrder,
  type StationTriggerOrder,
} from "@/lib/denis/stations/question-triggers";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

const config = {
  ...CONCIERGE_PLATFORM_DEFAULTS.ops.stationQuestions,
  enabled: true,
};

const NOW = Date.parse("2026-07-01T20:00:00Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

function order(overrides: Partial<StationTriggerOrder>): StationTriggerOrder {
  return {
    id: "order-1",
    orderNumber: 15,
    status: "preparing",
    createdAt: minutesAgo(0),
    preparingAt: null,
    readyAt: null,
    hasKitchenItems: true,
    hasDrinkItems: false,
    kitchenStation: null,
    barStation: null,
    ...overrides,
  };
}

describe("evaluateStationQuestionTriggers", () => {
  it("asks kitchen when food order breaches the SLA (T2)", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [order({ createdAt: minutesAgo(15) })],
      config,
      now: NOW,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      station: "kitchen",
      questionType: "eta",
      sourceEvent: "sla_breach",
      waitMinutes: 15,
    });
  });

  it("stays silent below the SLA — no small-delay spam", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [order({ createdAt: minutesAgo(8) })],
      config,
      now: NOW,
    });

    expect(candidates).toHaveLength(0);
  });

  it("asks kitchen when a pending order sits unaccepted (T5)", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [order({ status: "pending", createdAt: minutesAgo(3) })],
      config,
      now: NOW,
    });

    expect(candidates[0]).toMatchObject({
      questionType: "pending_accept",
      sourceEvent: "pending_too_long",
    });
  });

  it("asks the station when a ready order is not picked up (T6)", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [
        order({
          status: "ready",
          createdAt: minutesAgo(20),
          readyAt: minutesAgo(3),
        }),
      ],
      config,
      now: NOW,
    });

    expect(candidates[0]).toMatchObject({
      questionType: "ready_pickup",
      sourceEvent: "ready_not_picked",
      waitMinutes: 3,
    });
  });

  it("asks the bar about drinks on a mixed order (T4)", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [
        order({
          createdAt: minutesAgo(6),
          hasKitchenItems: true,
          hasDrinkItems: true,
        }),
      ],
      config,
      now: NOW,
    });

    expect(candidates[0]).toMatchObject({
      station: "bar",
      questionType: "mixed_conflict",
    });
  });

  it("skips mixed_conflict when bar station is already served (ADR-043 S3)", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [
        order({
          createdAt: minutesAgo(6),
          hasKitchenItems: true,
          hasDrinkItems: true,
          barStation: {
            status: "served",
            readyAt: minutesAgo(4),
            pickedUpAt: minutesAgo(3),
          },
          kitchenStation: {
            status: "in_prep",
            readyAt: null,
            pickedUpAt: null,
          },
        }),
      ],
      config,
      now: NOW,
    });

    expect(candidates.filter((c) => c.questionType === "mixed_conflict")).toHaveLength(0);
  });

  it("uses station ready_at for ready_pickup (T6)", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [
        order({
          status: "preparing",
          createdAt: minutesAgo(20),
          hasKitchenItems: true,
          hasDrinkItems: false,
          kitchenStation: {
            status: "ready",
            readyAt: minutesAgo(3),
            pickedUpAt: null,
          },
        }),
      ],
      config,
      now: NOW,
    });

    expect(candidates[0]).toMatchObject({
      station: "kitchen",
      questionType: "ready_pickup",
      waitMinutes: 3,
    });
  });

  it("routes drinks-only orders to the bar with the drink SLA", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [
        order({
          createdAt: minutesAgo(5),
          hasKitchenItems: false,
          hasDrinkItems: true,
        }),
      ],
      config,
      now: NOW,
    });

    expect(candidates[0]).toMatchObject({
      station: "bar",
      questionType: "eta",
      sourceEvent: "sla_breach",
    });
  });

  it("ignores delivered and cancelled orders", () => {
    const candidates = evaluateStationQuestionTriggers({
      orders: [
        order({ status: "delivered", createdAt: minutesAgo(40) }),
        order({ id: "order-2", status: "cancelled", createdAt: minutesAgo(40) }),
      ],
      config,
      now: NOW,
    });

    expect(candidates).toHaveLength(0);
  });
});

describe("stationForOrder", () => {
  it("prefers kitchen for mixed orders", () => {
    expect(
      stationForOrder({ hasKitchenItems: true, hasDrinkItems: true })
    ).toBe("kitchen");
    expect(
      stationForOrder({ hasKitchenItems: false, hasDrinkItems: true })
    ).toBe("bar");
  });
});

describe("buildStationQuestionMessage", () => {
  it("builds the ETA card copy with table, bon and wait", () => {
    const message = buildStationQuestionMessage({
      questionType: "eta",
      station: "kitchen",
      tableName: "15",
      orderNumber: 15,
      waitMinutes: 18,
    });

    expect(message).toBe(
      "Sto 15 · Bon #15 — gost čeka 18 min. Kada je gotovo?"
    );
  });

  it("handles missing order numbers", () => {
    const message = buildStationQuestionMessage({
      questionType: "pending_accept",
      station: "kitchen",
      tableName: "7",
      orderNumber: null,
      waitMinutes: 3,
    });

    expect(message).toContain("Sto 7");
    expect(message).not.toContain("#");
  });
});
