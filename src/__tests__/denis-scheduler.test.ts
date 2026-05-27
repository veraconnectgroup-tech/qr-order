import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { buildScheduleDrafts } from "@/lib/denis/kernel/scheduler/build-schedules";
import { evaluateScheduledIntent } from "@/lib/denis/kernel/scheduler/evaluate-proactive";
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
});

describe("scheduler evaluate M8", () => {
  it("emits pairing nudge for recent order", () => {
    const evaluation = evaluateScheduledIntent({
      intentType: "EVALUATE_PAIRING",
      payload: { orderId: "o1" },
      orders: [order({ id: "o1" })],
      shownNudgeKeys: [],
      slowKitchenThresholdMinutes: 25,
      now: new Date("2026-05-27T12:00:00.000Z").getTime(),
    });
    expect(evaluation?.kind).toBe("pairing");
    expect(evaluation?.message).toContain("Burger");
  });

  it("respects shown dedupe keys", () => {
    const evaluation = evaluateScheduledIntent({
      intentType: "EVALUATE_PAIRING",
      payload: { orderId: "o1" },
      orders: [order({ id: "o1" })],
      shownNudgeKeys: ["pairing:o1"],
      slowKitchenThresholdMinutes: 25,
      now: new Date("2026-05-27T12:00:00.000Z").getTime(),
    });
    expect(evaluation).toBeNull();
  });
});
