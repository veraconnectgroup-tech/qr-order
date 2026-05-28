import { describe, expect, it } from "vitest";
import {
  AI_LOW_BALANCE_THRESHOLD,
  BILLING_EVENT_TYPES,
  creditsPerTurn,
} from "@/lib/denis/commercial";
import {
  DENIS_AI_CREDITS_PER_TURN,
  DENIS_AI_LOW_BALANCE_THRESHOLD,
  denisAiCreditsMarketingEn,
} from "@/lib/constants";

describe("Denis commercial spine (ADR-009)", () => {
  it("charges one credit per LLM turn by default", () => {
    expect(creditsPerTurn()).toBe(1);
  });

  it("defines billing event type constants", () => {
    expect(BILLING_EVENT_TYPES.turnDebited).toBe("billing.turn_debited");
    expect(BILLING_EVENT_TYPES.lowBalance).toBe("billing.low_balance");
    expect(BILLING_EVENT_TYPES.creditsPurchased).toBe(
      "billing.credits_purchased"
    );
  });

  it("uses low-balance threshold aligned with outbox handler", () => {
    expect(AI_LOW_BALANCE_THRESHOLD).toBe(10);
    expect(DENIS_AI_LOW_BALANCE_THRESHOLD).toBe(AI_LOW_BALANCE_THRESHOLD);
  });

  it("aligns marketing copy with metering defaults", () => {
    expect(creditsPerTurn()).toBe(DENIS_AI_CREDITS_PER_TURN);
    const copy = denisAiCreditsMarketingEn();
    expect(copy.perTurn).toContain("1 credit");
    expect(copy.starterLabel).toContain("500");
  });
});
