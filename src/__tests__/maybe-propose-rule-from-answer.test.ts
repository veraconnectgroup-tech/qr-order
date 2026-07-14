import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("maybeProposeRuleFromAnswer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("proposes a rule when the assessment says permanent with enough confidence", async () => {
    vi.doMock("@/lib/denis/cognition/perceive/assess-rule-candidate", () => ({
      assessRuleCandidate: vi.fn().mockResolvedValue({
        present: true,
        ruleText: "We can always swap fries for salad.",
        scopeClaim: "permanent",
        confidence: 0.9,
        quotedSpan: "yeah always",
      }),
    }));
    const proposeRestaurantRule = vi
      .fn()
      .mockResolvedValue({ ok: true, id: "proposal-1" });
    vi.doMock("@/lib/denis/knowledge/restaurant-knowledge-store", () => ({
      proposeRestaurantRule,
    }));
    const { maybeProposeRuleFromAnswer } = await import(
      "@/lib/denis/cognition/policy/maybe-propose-rule-from-answer"
    );

    const admin = {} as SupabaseClient;
    const result = await maybeProposeRuleFromAnswer(admin, {
      locationId: "loc-1",
      answerText: "yeah we can always do that",
      staffId: "staff-1",
      sourceAiSessionId: "session-1",
    });

    expect(result).toEqual({ proposed: true, id: "proposal-1" });
    expect(proposeRestaurantRule).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        locationId: "loc-1",
        text: "We can always swap fries for salad.",
        proposedByStaffId: "staff-1",
        sourceAiSessionId: "session-1",
      })
    );
  });

  it("does not propose anything for a one_time exception", async () => {
    vi.doMock("@/lib/denis/cognition/perceive/assess-rule-candidate", () => ({
      assessRuleCandidate: vi.fn().mockResolvedValue({
        present: true,
        ruleText: "Just for tonight, we'll do a substitution.",
        scopeClaim: "one_time",
        confidence: 0.9,
        quotedSpan: "just for tonight",
      }),
    }));
    const proposeRestaurantRule = vi.fn();
    vi.doMock("@/lib/denis/knowledge/restaurant-knowledge-store", () => ({
      proposeRestaurantRule,
    }));
    const { maybeProposeRuleFromAnswer } = await import(
      "@/lib/denis/cognition/policy/maybe-propose-rule-from-answer"
    );

    const admin = {} as SupabaseClient;
    const result = await maybeProposeRuleFromAnswer(admin, {
      locationId: "loc-1",
      answerText: "just for tonight we'll do a substitution",
      staffId: "staff-1",
    });

    expect(result).toEqual({ proposed: false, id: null });
    expect(proposeRestaurantRule).not.toHaveBeenCalled();
  });

  it("does nothing when the LLM assessment is unavailable", async () => {
    vi.doMock("@/lib/denis/cognition/perceive/assess-rule-candidate", () => ({
      assessRuleCandidate: vi.fn().mockResolvedValue(null),
    }));
    const proposeRestaurantRule = vi.fn();
    vi.doMock("@/lib/denis/knowledge/restaurant-knowledge-store", () => ({
      proposeRestaurantRule,
    }));
    const { maybeProposeRuleFromAnswer } = await import(
      "@/lib/denis/cognition/policy/maybe-propose-rule-from-answer"
    );

    const admin = {} as SupabaseClient;
    const result = await maybeProposeRuleFromAnswer(admin, {
      locationId: "loc-1",
      answerText: "hvala puno",
      staffId: "staff-1",
    });

    expect(result).toEqual({ proposed: false, id: null });
    expect(proposeRestaurantRule).not.toHaveBeenCalled();
  });
});
