import { describe, expect, it } from "vitest";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import { beliefGraph } from "@/lib/denis/cognition/tde/turn-plan-types";
import { DEFAULT_COMMERCE_POLICY } from "@/lib/commerce/policy/defaults";
import {
  buildPreorderConfirmationMessage,
  computeKitchenReleaseAt,
  computeNoShowCancelAt,
  isPreorderIntentMessage,
  parsePreorderScheduledTime,
  PREORDER_MIN_ADVANCE_MINUTES,
  shouldCancelPreorderForNoShow,
  validatePreorder,
} from "@/lib/denis/commerce/preorder-flow";

const NOW = Date.parse("2026-06-27T18:00:00.000Z");

describe("preorder intent parsing", () => {
  it('detects "naruči za 19:00" as preorder intent', () => {
    expect(isPreorderIntentMessage("Naruči za 19:00 dva schnitzela")).toBe(true);
  });

  it('detects "Hoću za 19:00" as preorder intent', () => {
    expect(isPreorderIntentMessage("Hoću za 19:00")).toBe(true);
  });

  it("parses scheduled time at least 30 minutes ahead", () => {
    const now = new Date(NOW);
    const scheduled = parsePreorderScheduledTime("Naruči za 19:00", now);
    expect(scheduled).toBe(new Date("2026-06-27T19:00:00.000Z").toISOString());
  });
});

describe("decideTurnPlan preorder routing", () => {
  it("routes preorder time request to transactional perceive", () => {
    const plan = decideTurnPlan({
      beliefs: beliefGraph([]),
      message: "Naruči za 19:00 dva schnitzela i pilsner",
      reflex: {
        usedT0: false,
        handoffCommand: null,
        reflex: null,
        plan: {
          transition: {
            fromNodeId: "collect",
            toNodeId: "collect",
            signal: "ORDER",
            skippedGuard: false,
          },
          flowNode: { nodeId: "collect", skills: [], narrateTemplate: null, guard: null },
          goals: [],
          topGoal: null,
          skills: [],
          primarySignal: "ORDER",
        },
      },
    });

    expect(plan.kind).toBe("transactional_perceive");
    expect(plan.reason).toBe("commerce.preorder.scheduled");
    expect(plan.suppressUpsell).toBe(true);
  });
});

describe("validatePreorder P3", () => {
  const baseRequest = {
    locationId: "loc-1",
    tableId: null,
    guestId: "guest-device-abc",
    items: [
      {
        productId: "p1",
        productName: "Ćevapi",
        quantity: 2,
        menuSection: "food",
        notes: "",
      },
      {
        productId: "p2",
        productName: "Pivo",
        quantity: 3,
        menuSection: "drinks",
        notes: "",
      },
    ],
    scheduledFor: "2026-06-27T18:00:00.000Z",
    note: null,
    paymentMethod: "on_arrival" as const,
  };

  it("computes kitchen release 18:40 for 19:00 slot with 20 min prep", () => {
    const scheduledFor = "2026-06-27T19:00:00.000Z";
    expect(
      computeKitchenReleaseAt({
        scheduledFor,
        prepTimeEstimateMinutes: 20,
      })
    ).toBe("2026-06-27T18:40:00.000Z");
  });

  it("computes kitchen release 19:40 for 20:00 slot with 20 min prep", () => {
    const scheduledFor = "2026-06-27T20:00:00.000Z";
    expect(
      computeKitchenReleaseAt({
        scheduledFor,
        prepTimeEstimateMinutes: 20,
      })
    ).toBe("2026-06-27T19:40:00.000Z");
  });

  it("accepts valid preorder at least 30 minutes ahead", () => {
    const scheduledFor = new Date(NOW + 45 * 60_000).toISOString();
    const result = validatePreorder({
      request: { ...baseRequest, scheduledFor },
      venueHours: { open: "10:00", close: "23:00" },
      unavailableProducts: [],
      prepTimeEstimate: 20,
      now: NOW,
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.kitchenReleaseAt).toBeDefined();
  });

  it("rejects preorder less than 30 minutes in advance", () => {
    const scheduledFor = new Date(NOW + 15 * 60_000).toISOString();
    const result = validatePreorder({
      request: { ...baseRequest, scheduledFor },
      venueHours: { open: "10:00", close: "23:00" },
      unavailableProducts: [],
      prepTimeEstimate: 20,
      now: NOW,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("minimum_30_minutes_advance");
  });

  it("rejects unavailable products", () => {
    const scheduledFor = new Date(
      NOW + PREORDER_MIN_ADVANCE_MINUTES * 60_000 + 60_000
    ).toISOString();
    const result = validatePreorder({
      request: { ...baseRequest, scheduledFor },
      venueHours: { open: "10:00", close: "23:00" },
      unavailableProducts: ["p2"],
      prepTimeEstimate: 20,
      now: NOW,
    });

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.startsWith("unavailable:"))).toBe(
      true
    );
  });

  it("computes no-show cancel 30 minutes after scheduled time", () => {
    const scheduledFor = "2026-06-27T20:00:00.000Z";
    expect(computeNoShowCancelAt({ scheduledFor })).toBe(
      "2026-06-27T20:30:00.000Z"
    );
  });

  it("builds Denis confirmation copy", () => {
    const message = buildPreorderConfirmationMessage({
      items: [
        {
          productId: "s1",
          productName: "Schnitzel",
          quantity: 2,
          menuSection: "food",
          notes: "",
        },
        {
          productId: "p1",
          productName: "Pilsner",
          quantity: 1,
          menuSection: "drinks",
          notes: "",
        },
      ],
      scheduledFor: "2026-06-27T19:00:00.000Z",
      prepTimeEstimateMinutes: 20,
      language: "sr",
    });
    expect(message).toContain("2× Schnitzel i Pilsner");
    expect(message).toContain("za 19:00");
    expect(message).toContain("Kuhinja počinje u 18:40");
    expect(message).toContain("Do viđenja!");
  });
});

describe("no-show cancel", () => {
  it("cancels confirmed preorder when guest never arrived", () => {
    expect(
      shouldCancelPreorderForNoShow({
        status: "confirmed",
        sessionId: null,
      })
    ).toBe(true);
  });

  it("skips cancel when guest session exists", () => {
    expect(
      shouldCancelPreorderForNoShow({
        status: "confirmed",
        sessionId: "session-1",
      })
    ).toBe(false);
  });
});

describe("preorder.scheduled capability", () => {
  it("is enabled in shadow mode", () => {
    expect(
      DEFAULT_COMMERCE_POLICY.capabilities["preorder.scheduled"].enabled
    ).toBe(true);
    expect(
      DEFAULT_COMMERCE_POLICY.capabilities["preorder.scheduled"].rollout.mode
    ).toBe("shadow");
  });
});
