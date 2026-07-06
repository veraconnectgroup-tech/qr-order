import { describe, expect, it } from "vitest";
import { resolveStationVoiceSnapshot } from "@/lib/denis/venue/floor/resolve-station-voice-snapshot";
import type { KitchenBacklogOrder } from "@/lib/denis/venue/floor/compute-kds-backlog";

const NOW = Date.parse("2026-01-01T12:00:00.000Z");

function minutesAgo(minutes: number): string {
  return new Date(NOW - minutes * 60_000).toISOString();
}

describe("resolveStationVoiceSnapshot", () => {
  it("is calm with no open questions and no backlog", () => {
    const snapshot = resolveStationVoiceSnapshot({
      orders: [],
      openQuestionCount: 0,
      station: "kitchen",
      nowMs: NOW,
    });
    expect(snapshot).toEqual({ venueChaosRatio: 0, openQuestionCount: 0 });
  });

  it("rises with real kitchen order backlog, not just open question count", () => {
    const orders: KitchenBacklogOrder[] = [
      {
        status: "preparing",
        created_at: minutesAgo(25),
        accepted_at: minutesAgo(24),
        preparing_at: minutesAgo(22),
        order_items: [{ menu_section: "food" }],
      },
    ];

    const snapshot = resolveStationVoiceSnapshot({
      orders,
      openQuestionCount: 0,
      station: "kitchen",
      nowMs: NOW,
    });

    expect(snapshot.venueChaosRatio).toBe(1);
  });

  it("only counts backlog for the matching station", () => {
    const barOrders: KitchenBacklogOrder[] = [
      {
        status: "preparing",
        created_at: minutesAgo(30),
        accepted_at: minutesAgo(30),
        preparing_at: minutesAgo(30),
        order_items: [{ menu_section: "drinks" }],
      },
    ];

    const kitchenSnapshot = resolveStationVoiceSnapshot({
      orders: barOrders,
      openQuestionCount: 0,
      station: "kitchen",
      nowMs: NOW,
    });
    const barSnapshot = resolveStationVoiceSnapshot({
      orders: barOrders,
      openQuestionCount: 0,
      station: "bar",
      nowMs: NOW,
    });

    expect(kitchenSnapshot.venueChaosRatio).toBe(0);
    expect(barSnapshot.venueChaosRatio).toBe(1);
  });

  it("passes through openQuestionCount unchanged", () => {
    const snapshot = resolveStationVoiceSnapshot({
      orders: [],
      openQuestionCount: 3,
      station: "bar",
      nowMs: NOW,
    });
    expect(snapshot.openQuestionCount).toBe(3);
  });
});
