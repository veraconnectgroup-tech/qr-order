import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { buildScheduleDrafts } from "@/lib/denis/kernel/scheduler/build-schedules";
import type { SchedulerOrderSnapshot } from "@/lib/denis/kernel/scheduler/types";

const now = new Date("2026-05-27T11:59:00.000Z");

function order(
  partial: Partial<SchedulerOrderSnapshot> & Pick<SchedulerOrderSnapshot, "id">
): SchedulerOrderSnapshot {
  return {
    status: "accepted",
    created_at: "2026-05-27T11:58:00.000Z",
    delivered_at: null,
    order_items: [{ product_name: "Burger", quantity: 1, menu_section: "food" }],
    ...partial,
  };
}

describe("scheduler build M8", () => {
  it("creates pairing and slow kitchen drafts for active orders", () => {
    const drafts = buildScheduleDrafts({
      orders: [order({ id: "o1" })],
      config: CONCIERGE_PLATFORM_DEFAULTS,
      now,
    });
    expect(drafts.some((d) => d.intentType === "EVALUATE_PAIRING")).toBe(true);
    expect(drafts.some((d) => d.intentType === "SLOW_KITCHEN_CHECK")).toBe(true);
  });

  it("skips schedules when proactive disabled", () => {
    const drafts = buildScheduleDrafts({
      orders: [order({ id: "o1" })],
      config: {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        proactive: { ...CONCIERGE_PLATFORM_DEFAULTS.proactive, enabled: false },
      },
      now,
    });
    expect(drafts).toHaveLength(0);
  });

  it("uses INTERVENTION_WAKE for dessert defer when IJS active", () => {
    const drafts = buildScheduleDrafts({
      orders: [
        order({
          id: "o1",
          status: "delivered",
          delivered_at: "2026-05-27T11:40:00.000Z",
        }),
      ],
      config: CONCIERGE_PLATFORM_DEFAULTS,
      interventionJournalActive: true,
      now,
    });
    expect(drafts.some((row) => row.intentType === "INTERVENTION_WAKE")).toBe(true);
    expect(drafts.some((row) => row.intentType === "DESSERT_UPSELL")).toBe(false);
  });

  it("uses rhythm effective dessert delay when provided (VRP-P1)", () => {
    const drafts = buildScheduleDrafts({
      orders: [
        order({
          id: "o1",
          status: "delivered",
          delivered_at: "2026-05-27T11:40:00.000Z",
        }),
      ],
      config: CONCIERGE_PLATFORM_DEFAULTS,
      effectiveDessertDelayMinutes: 12,
      now: new Date("2026-05-27T11:45:00.000Z"),
    });
    const dessert = drafts.find((row) => row.intentType === "DESSERT_UPSELL");
    expect(dessert?.runAt).toBe("2026-05-27T11:52:00.000Z");
  });
});
