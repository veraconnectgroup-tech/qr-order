import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { computeKdsBacklogMinutes } from "@/lib/denis/venue/floor/compute-kds-backlog";
import { deriveTableOperatingHint } from "@/lib/denis/venue/floor/derive-table-hint";
import { resolveEffectiveVenueOps } from "@/lib/denis/venue/floor/resolve-effective-ops";
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

const floorWithBacklog = (minutes: number): Pick<FloorGraph, "house"> => ({
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
  it("flags needs_attention when kitchen order is late", () => {
    const hint = deriveTableOperatingHint({
      sessionOpenedAt: "2026-05-27T11:00:00.000Z",
      orders: [
        {
          status: "preparing",
          created_at: "2026-05-27T11:00:00.000Z",
          hasKitchenItems: true,
          hasDessert: false,
        },
      ],
      lastGuestActivityAt: "2026-05-27T11:05:00.000Z",
      backlogThresholdMinutes: 20,
      nowMs: Date.parse("2026-05-27T11:30:00.000Z"),
    });
    expect(hint).toBe("needs_attention");
  });

  it("suggests dessert after food delivered and long seated time", () => {
    const hint = deriveTableOperatingHint({
      sessionOpenedAt: "2026-05-27T10:00:00.000Z",
      orders: [
        {
          status: "delivered",
          created_at: "2026-05-27T10:05:00.000Z",
          hasKitchenItems: true,
          hasDessert: false,
        },
      ],
      lastGuestActivityAt: "2026-05-27T10:50:00.000Z",
      backlogThresholdMinutes: 20,
      nowMs: Date.parse("2026-05-27T11:00:00.000Z"),
    });
    expect(hint).toBe("ready_for_dessert");
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

  it("elevates to rush + high KDS stress when auto rush enabled", () => {
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
      normalOps,
      floorWithBacklog(25),
      config
    );
    expect(effective.operatingMode).toBe("rush");
    expect(effective.kdsStress).toBe("high");

    const effects = deriveOpsPlannerEffects(effective, config);
    expect(effects.skipUpsell).toBe(true);
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
