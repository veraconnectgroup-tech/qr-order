import { describe, expect, it } from "vitest";
import { orchestrate } from "@/lib/denis/runtime/orchestrate-table-lifecycle";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";

describe("orchestrate-table-lifecycle (Phase 3 conductor)", () => {
  it("ne govori dok gost jede", () => {
    const result = orchestrate({
      phase: "eating",
      minutesSinceDelivery: 5,
      drinkEstimatedEmpty: false,
    });

    expect(result.action.kind).toBe("silence");
    expect(result.action).toMatchObject({
      reason: expect.stringMatching(/ĆUTI|eating/i),
    });
  });

  it("nudi refill kad piće pri kraju", () => {
    const result = orchestrate({
      phase: "eating",
      minutesSinceDelivery: 18,
      drinkEstimatedEmpty: true,
      drinkFamily: "beer",
    });

    expect(result.action.kind).toBe("nudge");
    if (result.action.kind === "nudge") {
      expect(result.action.nudgeKind).toBe("drink_refill");
    }
    expect(result.phase).toBe("drink_refill");
  });

  it("ne nudi desert gostu koji nikad ne naručuje desert", () => {
    const guestMemory = {
      hasMemoryConsent: true,
      preferredMealPattern: "main_only",
    } as GuestMemoryProjection;

    const result = orchestrate({
      phase: "dessert_window",
      guestMemory,
    });

    expect(result.action.kind).toBe("speak");
    if (result.action.kind === "speak") {
      expect(result.action.message).toMatch(/coffee|bill|kafa|račun/i);
      expect(result.action.message).not.toMatch(/dessert|desert|sladoled/i);
    }
  });
});
