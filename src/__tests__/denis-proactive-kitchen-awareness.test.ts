import { describe, expect, it } from "vitest";
import type { AiGuestOrder } from "@/lib/ai/order-context";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { detectStaffProactiveAlerts } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { rankProactiveCandidates } from "@/lib/denis/cognition/proactive/rank-proactive-candidates";
import {
  detectMultiTableDelayAlert,
  detectOrderEtaUpdateTrigger,
  detectOrderReadyNotifyTrigger,
} from "@/lib/denis/cognition/proactive/triggers";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { cloneConciergePlatformDefaults } from "@/lib/denis/config/concierge-defaults";

const now = Date.parse("2026-06-07T20:00:00.000Z");

function order(partial: Partial<AiGuestOrder> & { id: string }): AiGuestOrder {
  return {
    id: partial.id,
    status: partial.status ?? "preparing",
    created_at: partial.created_at ?? new Date(now - 18 * 60_000).toISOString(),
    delivered_at: partial.delivered_at ?? null,
    estimated_prep_minutes: partial.estimated_prep_minutes ?? null,
    prep_estimate_confidence: partial.prep_estimate_confidence ?? "none",
    order_items: partial.order_items ?? [
      {
        product_id: "burger-id",
        product_name: "Burger",
        unit_price: 12,
        quantity: 1,
        menu_section: "food",
      },
    ],
  };
}

const rankMessages = {
  browse: "Browse",
  dessert: "Dessert",
  slowKitchen: "fallback",
  guestWelcome: "Welcome",
  browseFollowUp: "Follow up",
  billPrompt: "Bill",
  orderDelay: "Delay",
  popularityPair: "Pair",
};

describe("kitchen awareness situation pack", () => {
  it("shows backlog_level busy when kitchen has 8 pending orders", () => {
    const pack = buildSituationPack({
      state: {
        table: { id: "t1", name: "T8", token: "tok" },
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
          cart: { ai: emptyCartState(), visibleLines: [] },
        },
        config: cloneConciergePlatformDefaults(),
      } as never,
      beliefs: beliefGraph([]),
      sessionPhase: "browsing",
      venueOps: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
        stationStress: [
          {
            station: "kitchen",
            stress: "high",
            activeCount: 8,
            avgWaitMinutes: 15,
          },
        ],
      },
    });

    expect(pack).toContain("KITCHEN:");
    expect(pack).toContain("backlog_level: busy");
    expect(pack).toContain("do not push complex dishes");
  });
});

describe("kitchen awareness proactive triggers", () => {
  it("emits order_eta_update trigger and slow_kitchen nudge when order waits 18min with 10min estimate", () => {
    const trigger = detectOrderEtaUpdateTrigger(
      [
        order({
          id: "o-late",
          estimated_prep_minutes: 10,
          created_at: new Date(now - 18 * 60_000).toISOString(),
        }),
      ],
      () => false,
      now
    );

    expect(trigger?.kind).toBe("order_eta_update");
    expect(trigger?.waitMinutes).toBe(18);

    const ranked = rankProactiveCandidates({
      config: cloneConciergePlatformDefaults(),
      orders: [
        order({
          id: "o-late",
          estimated_prep_minutes: 10,
          created_at: new Date(now - 18 * 60_000).toISOString(),
        }),
      ],
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now,
    });

    // slow_kitchen supersedes order_eta_update for the same order when both fire
    expect(ranked.some((row) => row.nudge.kind === "slow_kitchen")).toBe(true);
    expect(ranked.some((row) => row.nudge.kind === "order_eta_update")).toBe(
      false
    );
  });

  it("emits order_ready_notify push candidate when order becomes ready", () => {
    const trigger = detectOrderReadyNotifyTrigger(
      [order({ id: "o-ready", status: "ready" })],
      () => false
    );
    expect(trigger?.kind).toBe("order_ready_notify");

    const ranked = rankProactiveCandidates({
      config: cloneConciergePlatformDefaults(),
      orders: [order({ id: "o-ready", status: "ready" })],
      payload: {
        dismissedNudgeKeys: [],
        language: "sr",
        sessionPhase: "waiting",
        hasSessionOrders: true,
      },
      messages: rankMessages,
      now,
    });

    const ready = ranked.find((row) => row.nudge.kind === "order_ready_notify");
    expect(ready?.nudge.message).toContain("spremn");
  });
});

describe("multi_table_delay_alert staff escalation", () => {
  it("emits staff alert when 3 tables wait 25min", () => {
    const escalation = detectMultiTableDelayAlert([
      { tableId: "t1", tableName: "Sto 1", waitMinutes: 25 },
      { tableId: "t2", tableName: "Sto 2", waitMinutes: 27 },
      { tableId: "t3", tableName: "Sto 3", waitMinutes: 30 },
    ]);
    expect(escalation).not.toBeNull();

    const alerts = detectStaffProactiveAlerts({
      config: cloneConciergePlatformDefaults(),
      tableName: "Sto 1",
      idleMinutes: 0,
      hasSessionOrders: false,
      emittedKeys: [],
      recentGuestMessages: [],
      waiterEscalated: false,
      kitchenTableWaits: [
        { tableId: "t1", tableName: "Sto 1", waitMinutes: 25 },
        { tableId: "t2", tableName: "Sto 2", waitMinutes: 27 },
        { tableId: "t3", tableName: "Sto 3", waitMinutes: 30 },
      ],
    });

    expect(alerts.some((a) => a.kind === "staff_multi_table_delay")).toBe(true);
  });
});
