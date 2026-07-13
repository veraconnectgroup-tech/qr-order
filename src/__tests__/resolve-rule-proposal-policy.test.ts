import { describe, expect, it } from "vitest";
import { resolveRuleProposalPolicy } from "@/lib/denis/cognition/policy/resolve-rule-proposal-policy";
import type { RuleCandidateAssessment } from "@/lib/denis/cognition/policy/rule-classification-types";

function assessment(
  overrides: Partial<RuleCandidateAssessment> = {}
): RuleCandidateAssessment {
  return {
    present: true,
    ruleText: "We can always swap fries for salad.",
    scopeClaim: "permanent",
    confidence: 0.9,
    quotedSpan: "yeah we can always do that",
    ...overrides,
  };
}

describe("resolveRuleProposalPolicy", () => {
  it("proposes pending confirmation for a permanent rule", () => {
    expect(resolveRuleProposalPolicy(assessment({ scopeClaim: "permanent" }))).toBe(
      "propose_pending"
    );
  });

  it("proposes pending confirmation for an unclear scope (never auto-confirms)", () => {
    expect(resolveRuleProposalPolicy(assessment({ scopeClaim: "unclear" }))).toBe(
      "propose_pending"
    );
  });

  it("never proposes a one_time exception as durable knowledge", () => {
    expect(resolveRuleProposalPolicy(assessment({ scopeClaim: "one_time" }))).toBe(
      "none"
    );
  });

  it("does nothing when nothing was present in the answer", () => {
    expect(
      resolveRuleProposalPolicy(assessment({ present: false, ruleText: null }))
    ).toBe("none");
  });

  it("does nothing below the confidence threshold", () => {
    expect(resolveRuleProposalPolicy(assessment({ confidence: 0.2 }))).toBe("none");
  });

  it("does nothing when the assessment is null (LLM unavailable/failed)", () => {
    expect(resolveRuleProposalPolicy(null)).toBe("none");
  });
});
