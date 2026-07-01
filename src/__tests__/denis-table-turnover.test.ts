import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  deriveTrajectoryFromFloor,
  detectRushMode,
  ewmaTurnoverMinutes,
  formatTurnoverCopilotLine,
  predictTableTurnover,
  turnoverDisplayStatus,
} from "@/lib/denis/intelligence/table-turnover";
import { shouldAutoRushFromFloor } from "@/lib/denis/venue/floor/should-auto-rush-from-floor";
import { deriveOpsPlannerEffects } from "@/lib/denis/venue/ops/planner-effects";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const NOW = Date.parse("2026-06-27T14:00:00.000Z");

describe("detectRushMode M2", () => {
  it("12 tables, 11 active, kds backlog 8 → rush=true", () => {
    const rush = detectRushMode({
      activeTableCount: 11,
      totalTables: 12,
      avgWaitMinutes: 15,
      kdsBacklog: 8,
    });

    expect(rush.isRush).toBe(true);
    expect(rush.reason).toContain("11/12");
  });

  it("low occupancy does not trigger rush", () => {
    const rush = detectRushMode({
      activeTableCount: 4,
      totalTables: 12,
      avgWaitMinutes: 20,
      kdsBacklog: 10,
    });

    expect(rush.isRush).toBe(false);
    expect(rush.suggestNormal).toBe(true);
  });
});

describe("shouldAutoRushFromFloor + skipUpsell M2", () => {
  it("occupancy rush elevates effective ops and skipUpsell", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      ops: {
        ...CONCIERGE_PLATFORM_DEFAULTS.ops,
        autoRushEnabled: true,
        autoRushBacklogMinutes: 20,
        rushSkipUpsell: true,
      },
    };

    const floor = {
      house: {
        operatingMode: "normal" as const,
        kdsBacklogMinutes: 5,
        activeOrderCount: 8,
        staffOnFloor: 2,
        houseHint: null,
        stationQueues: [
          {
            station: "kitchen" as const,
            activeOrderCount: 8,
            avgWaitMinutes: 15,
            oldestOrderMinutes: 18,
          },
        ],
      },
      tables: Array.from({ length: 12 }, (_, index) => ({
        tableId: `t-${index}`,
        tableSessionId: index < 11 ? `s-${index}` : null,
        seatedMinutes: 25,
        openOrderCount: 1,
        lastGuestActivityAt: null,
        aiSessionId: null,
        operatingHint: null,
        guestWaitMinutes: 15,
        idleMinutes: null,
        allOrdersDelivered: false,
        minutesSinceLastDelivery: null,
      })),
    };

    expect(shouldAutoRushFromFloor(floor, config)).toBe(true);

    const rushOps: VenueOpsBeliefs = {
      operatingMode: "rush",
      kdsStress: "high",
      acceptingOrders: true,
      unavailableProductIds: [],
      staffHint: null,
      stationStress: [],
    };
    const effects = deriveOpsPlannerEffects(rushOps, config);
    expect(effects.skipUpsell).toBe(true);
    expect(effects.shortenReplies).toBe(true);
  });
});

describe("predictTableTurnover M2", () => {
  it("post-meal idle predicts ~5 min remaining", () => {
    const trajectory = deriveTrajectoryFromFloor({
      seatedMinutes: 38,
      openOrderCount: 0,
      allOrdersDelivered: true,
      idleMinutes: 12,
      guestWaitMinutes: null,
      minutesSinceLastDelivery: 8,
    });

    const prediction = predictTableTurnover({
      tableId: "t-1",
      tableName: "Sto 4",
      trajectory,
      sessionStartedAt: new Date(NOW - 38 * 60_000).toISOString(),
      ordersFacts: [],
      historicalAvgMinutes: 70,
      now: NOW,
    });

    expect(prediction).not.toBeNull();
    expect(prediction!.estimatedRemainingMin).toBeLessThanOrEqual(5);
    expect(prediction!.mealStage).toBe("post");
    expect(formatTurnoverCopilotLine(prediction!)).toContain("Sto 4");
  });

  it("paying stage predicts ~2 min remaining", () => {
    const trajectory = deriveTrajectoryFromFloor({
      seatedMinutes: 80,
      openOrderCount: 0,
      allOrdersDelivered: true,
      idleMinutes: 5,
      guestWaitMinutes: null,
      minutesSinceLastDelivery: 35,
    });

    const prediction = predictTableTurnover({
      tableId: "t-2",
      tableName: "Sto 7",
      trajectory,
      sessionStartedAt: new Date(NOW - 80 * 60_000).toISOString(),
      ordersFacts: [],
      historicalAvgMinutes: 75,
      now: NOW,
    });

    expect(prediction?.estimatedRemainingMin).toBe(2);
    expect(turnoverDisplayStatus(prediction!)).toBe("ready_soon");
  });

  it("long post-meal flags long sitting", () => {
    const trajectory = deriveTrajectoryFromFloor({
      seatedMinutes: 45,
      openOrderCount: 0,
      allOrdersDelivered: true,
      idleMinutes: 25,
      guestWaitMinutes: null,
      minutesSinceLastDelivery: 20,
    });

    const prediction = predictTableTurnover({
      tableId: "t-3",
      tableName: "Sto 2",
      trajectory,
      sessionStartedAt: new Date(NOW - 45 * 60_000).toISOString(),
      ordersFacts: [],
      historicalAvgMinutes: 60,
      now: NOW,
    });

    expect(turnoverDisplayStatus(prediction!)).toBe("long_sitting");
  });
});

describe("ewmaTurnoverMinutes", () => {
  it("weights recent sessions higher", () => {
    const avg = ewmaTurnoverMinutes([90, 60, 55], 75);
    expect(avg).toBeLessThan(75);
    expect(avg).toBeGreaterThan(55);
  });
});
