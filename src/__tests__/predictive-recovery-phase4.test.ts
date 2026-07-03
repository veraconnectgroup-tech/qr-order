import {
  detectEngagementDrop,
  detectPredictiveRecovery,
} from "@/lib/denis/cognition/recovery/detect-predictive-recovery";
import {
  applyTableLifecycleToCandidates,
  orchestrateTableLifecycle,
} from "@/lib/denis/cognition/lifecycle/orchestrate-table-lifecycle";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import type { OrderFact } from "@/lib/denis/loop/types";

const NOW = Date.parse("2026-06-07T20:00:00.000Z");

function preparingOrder(minutesAgo: number): OrderFact {
  return {
    id: "o1",
    orderNumber: 42,
    status: "preparing",
    paymentStatus: "paid",
    estimatedPrepMinutes: 12,
    createdAt: new Date(NOW - minutesAgo * 60_000).toISOString(),
    items: [{ productName: "Burger", quantity: 1, menuSection: "food" }],
  };
}

describe("detectPredictiveRecovery", () => {
  it("flags kitchen delay proactive after threshold without complaint", () => {
    const result = detectPredictiveRecovery({
      orders: [preparingOrder(22)],
      guestMessages: ["Možete li preporučiti nešto?", "Hvala"],
      orderDelayMinutes: 15,
      nowMs: NOW,
    });

    expect(result.signals).toContain("kitchen_delay_proactive");
    expect(result.kitchenWaitMinutes).toBe(22);
    expect(result.shouldBoostEmpathy).toBe(true);
  });

  it("skips kitchen delay proactive when guest already complained", () => {
    const result = detectPredictiveRecovery({
      orders: [preparingOrder(25)],
      guestMessages: ["Čekam predugo", "Ovo je loše"],
      nowMs: NOW,
    });

    expect(result.signals).not.toContain("kitchen_delay_proactive");
  });

  it("detects engagement drop from short recent replies", () => {
    expect(
      detectEngagementDrop([
        "Možete li mi preporučiti nešto za vegetarijce?",
        "Imate li bez glutena opcije?",
        "Ok",
        "Mhm",
        "Da",
      ])
    ).toBe(true);
  });
});

describe("orchestrateTableLifecycle + predictive recovery", () => {
  it("boosts slow_kitchen when kitchen delay proactive", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      intent: "waiting_food" as const,
      nudgeBudget: { remaining: 3, max: 3, cooldownUntil: null },
    };

    const lifecycle = orchestrateTableLifecycle({
      mental,
      tableTempoPhase: "none",
      orders: [preparingOrder(22)],
      cartLineCount: 0,
      predictiveRecovery: {
        signals: ["kitchen_delay_proactive"],
        kitchenWaitMinutes: 22,
        shouldBoostEmpathy: true,
      },
    });

    expect(lifecycle.evidence).toContain("recovery.kitchen_delay_proactive");
    expect(lifecycle.preferredKinds[0]).toBe("slow_kitchen");

    const ranked = applyTableLifecycleToCandidates({
      lifecycle,
      candidates: [
        { nudge: { kind: "slow_kitchen" as const }, priority: 500 },
        { nudge: { kind: "dessert_nudge" as const }, priority: 900 },
      ],
    });

    expect(ranked[0]?.nudge.kind).toBe("slow_kitchen");
  });
});
