import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { computeKdsBacklogMinutes } from "@/lib/denis/venue/floor/compute-kds-backlog";
import { computeStationQueues } from "@/lib/denis/venue/floor/compute-station-queues";
import { deriveStationStressFromQueues } from "@/lib/denis/venue/floor/derive-station-stress";
import {
  countTablesWithHint,
  deriveTableOperatingHint,
  FLOOR_HINT_THRESHOLDS,
} from "@/lib/denis/venue/floor/derive-table-hint";
import { resolveEffectiveVenueOps } from "@/lib/denis/venue/floor/resolve-effective-ops";
import { shouldAutoRushFromFloor } from "@/lib/denis/venue/floor/should-auto-rush-from-floor";
import type { FloorGraph } from "@/lib/denis/venue/floor/types";
import { deriveOpsPlannerEffects } from "@/lib/denis/venue/ops/planner-effects";
import type { VenueOpsBeliefs } from "@/lib/denis/venue/ops/types";

const normalOps: VenueOpsBeliefs = {
  operatingMode: "normal",
  kdsStress: "normal",
  acceptingOrders: true,
  unavailableProductIds: [],
  staffHint: null,
};

const floorWithBacklog = (minutes: number): Pick<FloorGraph, "house" | "tables"> => ({
  tables: [{ tableId: "t1", tableSessionId: "s1", seatedMinutes: 30, openOrderCount: 1, lastGuestActivityAt: null, aiSessionId: null, operatingHint: null }],
  house: {
    operatingMode: "normal",
    kdsBacklogMinutes: minutes,
    activeOrderCount: 3,
    staffOnFloor: null,
  },
});

describe("KDS backlog M14", () => {
  it("returns null when no kitchen orders", () => {
    expect(computeKdsBacklogMinutes([])).toBeNull();
  });

  it("averages elapsed minutes for active kitchen orders", () => {
    const now = Date.parse("2026-05-27T12:00:00.000Z");
    const backlog = computeKdsBacklogMinutes(
      [
        {
          status: "preparing",
          created_at: "2026-05-27T11:30:00.000Z",
          accepted_at: "2026-05-27T11:35:00.000Z",
          preparing_at: "2026-05-27T11:40:00.000Z",
          order_items: [{ menu_section: "food" }],
        },
        {
          status: "accepted",
          created_at: "2026-05-27T11:50:00.000Z",
          accepted_at: "2026-05-27T11:55:00.000Z",
          preparing_at: null,
          order_items: [{ menu_section: "desserts" }],
        },
      ],
      now
    );
    expect(backlog).toBe(13);
  });

  it("ignores drinks-only orders", () => {
    const now = Date.parse("2026-05-27T12:00:00.000Z");
    expect(
      computeKdsBacklogMinutes(
        [
          {
            status: "preparing",
            created_at: "2026-05-27T11:00:00.000Z",
            accepted_at: null,
            preparing_at: null,
            order_items: [{ menu_section: "drinks" }],
          },
        ],
        now
      )
    ).toBeNull();
  });
});

describe("table operating hints M14", () => {
  it("flags needs_attention after 15 min without guest interaction", () => {
    const hint = deriveTableOperatingHint({
      sessionOpenedAt: "2026-05-27T11:00:00.000Z",
      orders: [],
      lastGuestActivityAt: "2026-05-27T11:00:00.000Z",
      backlogThresholdMinutes: 20,
      nowMs: Date.parse("2026-05-27T11:16:00.000Z"),
    });
    expect(hint).toBe("needs_attention");
  });

  it("marks three tables waiting 15+ min as needs_attention", () => {
    const nowMs = Date.parse("2026-05-27T11:16:00.000Z");
    const tables = ["t1", "t2", "t3"].map((tableId) => ({
      tableId,
      operatingHint: deriveTableOperatingHint({
        sessionOpenedAt: "2026-05-27T11:00:00.000Z",
        orders: [],
        lastGuestActivityAt: "2026-05-27T11:00:00.000Z",
        backlogThresholdMinutes: 20,
        nowMs,
      }),
    }));

    expect(countTablesWithHint(tables, "needs_attention")).toBe(3);
    expect(FLOOR_HINT_THRESHOLDS.needsAttentionIdleMinutes).toBe(15);
  });

  it("suggests dessert 10 min after food delivery", () => {
    const hint = deriveTableOperatingHint({
      sessionOpenedAt: "2026-05-27T10:00:00.000Z",
      orders: [
        {
          status: "delivered",
          created_at: "2026-05-27T10:05:00.000Z",
          delivered_at: "2026-05-27T10:05:00.000Z",
          hasKitchenItems: true,
          hasDessert: false,
        },
      ],
      lastGuestActivityAt: "2026-05-27T10:14:00.000Z",
      backlogThresholdMinutes: 20,
      nowMs: Date.parse("2026-05-27T10:16:00.000Z"),
    });
    expect(hint).toBe("ready_for_dessert");
  });

  it("marks idle when seated 20+ min with no orders and recent activity", () => {
    const hint = deriveTableOperatingHint({
      sessionOpenedAt: "2026-05-27T11:00:00.000Z",
      orders: [],
      lastGuestActivityAt: "2026-05-27T11:15:00.000Z",
      backlogThresholdMinutes: 20,
      nowMs: Date.parse("2026-05-27T11:25:00.000Z"),
    });
    expect(hint).toBe("idle");
  });
});

describe("station stress M14", () => {
  it("computes average wait per station", () => {
    const now = Date.parse("2026-05-27T12:00:00.000Z");
    const queues = computeStationQueues(
      [
        {
          status: "preparing",
          created_at: "2026-05-27T11:30:00.000Z",
          accepted_at: "2026-05-27T11:35:00.000Z",
          preparing_at: "2026-05-27T11:40:00.000Z",
          order_items: [{ menu_section: "food" }],
        },
        {
          status: "preparing",
          created_at: "2026-05-27T11:50:00.000Z",
          accepted_at: null,
          preparing_at: null,
          order_items: [{ menu_section: "drinks" }],
        },
      ],
      now
    );

    const kitchen = queues.find((queue) => queue.station === "kitchen");
    const bar = queues.find((queue) => queue.station === "bar");

    expect(kitchen?.avgWaitMinutes).toBe(20);
    expect(bar?.avgWaitMinutes).toBe(10);
  });

  it("elevates kitchen stress when avg wait exceeds threshold", () => {
    const stress = deriveStationStressFromQueues(
      [
        {
          station: "kitchen",
          activeOrderCount: 2,
          avgWaitMinutes: 25,
          oldestOrderMinutes: 30,
        },
      ],
      20
    );

    expect(stress[0]?.stress).toBe("high");
  });
});

describe("auto rush from floor M14", () => {
  it("does not merge when floor graph GA gate is off", () => {
    const effective = resolveEffectiveVenueOps(
      normalOps,
      floorWithBacklog(30),
      CONCIERGE_PLATFORM_DEFAULTS
    );
    expect(effective.operatingMode).toBe("normal");
    expect(effective.kdsStress).toBe("normal");
  });

  it("elevates to rush + high KDS stress when backlog is 25 min", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      ops: {
        ...CONCIERGE_PLATFORM_DEFAULTS.ops,
        floorGraphEnabled: true,
        autoRushEnabled: true,
        autoRushBacklogMinutes: 20,
      },
    };

    expect(
      shouldAutoRushFromFloor(floorWithBacklog(25), config)
    ).toBe(true);

    const effective = resolveEffectiveVenueOps(
      normalOps,
      floorWithBacklog(25),
      config
    );
    expect(effective.operatingMode).toBe("rush");
    expect(effective.kdsStress).toBe("high");

    const effects = deriveOpsPlannerEffects(effective, config);
    expect(effects.skipUpsell).toBe(true);
    expect(effects.suppressProactiveNudges).toBe(true);
  });

  it("preserves manual kitchen_closed mode", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      ops: {
        ...CONCIERGE_PLATFORM_DEFAULTS.ops,
        floorGraphEnabled: true,
        autoRushEnabled: true,
        autoRushBacklogMinutes: 20,
      },
    };

    const effective = resolveEffectiveVenueOps(
      { ...normalOps, operatingMode: "kitchen_closed" },
      floorWithBacklog(25),
      config
    );
    expect(effective.operatingMode).toBe("kitchen_closed");
  });
});
