import { describe, expect, it } from "vitest";
import {
  aggregateLlmInvocationRate,
  buildTurnProfile,
  evaluateQualityContract,
  PLATFORM_QUALITY_CONTRACT,
  runQualityContractEval,
} from "@/lib/denis/cognition/quality";
import { isDenisRefusalReply } from "@/lib/ai/conversation-leadership";
import {
  GOLDEN_ASSISTANT_LINES,
  REFUSAL_ASSISTANT_LINES,
} from "@/lib/denis/eval/fixtures/quality-contract/refusal-messages";

describe("MR-7 quality contract", () => {
  it("buildTurnProfile captures TDE metadata", () => {
    const profile = buildTurnProfile({
      turnPlan: {
        kind: "transactional_perceive",
        requiresLlm: true,
        suppressUpsell: false,
        reason: "commerce.pressure.comprehend",
      },
      llmUsed: true,
      tier: "T2",
      evidencePointers: ["situation.pack"],
    });

    expect(profile.type).toBe("mind.turn_profile");
    expect(profile.planKind).toBe("transactional_perceive");
    expect(profile.llmUsed).toBe(true);
    expect(profile.tier).toBe("T2");
  });

  it("refusal fixtures are detected", () => {
    for (const line of REFUSAL_ASSISTANT_LINES) {
      expect(isDenisRefusalReply(line)).toBe(true);
    }
  });

  it("golden lines are not refusals", () => {
    for (const line of GOLDEN_ASSISTANT_LINES) {
      expect(isDenisRefusalReply(line)).toBe(false);
    }
  });

  it("aggregateLlmInvocationRate from timeline events", () => {
    const aggregate = aggregateLlmInvocationRate([
      {
        event_type: "mind.turn_profile",
        payload: { llmUsed: true },
      },
      {
        event_type: "mind.turn_profile",
        payload: { llmUsed: false },
      },
      {
        event_type: "signal.message",
        payload: {},
      },
    ]);

    expect(aggregate.turnCount).toBe(2);
    expect(aggregate.llmTurnCount).toBe(1);
    expect(aggregate.rate).toBe(0.5);
  });

  it("runQualityContractEval passes platform contract", () => {
    const result = runQualityContractEval(PLATFORM_QUALITY_CONTRACT);
    if (!result.ok) {
      console.error(result.violations);
    }
    expect(result.ok).toBe(true);
  });

  it("evaluateQualityContract fails when golden refusal rate exceeds max", () => {
    const result = evaluateQualityContract(PLATFORM_QUALITY_CONTRACT, {
      evalPassRate: 1,
      pilotSrPassRate: 1,
      waiterParityPassRate: 1,
      simLlmInvocationRate: 0.74,
      refusalDetectionRate: 1,
      goldenRefusalRate: 0.5,
      scenarioCount: 10,
    });

    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("golden refusal"))).toBe(
      true
    );
  });

  it("evaluateQualityContract fails when live llm rate exceeds max", () => {
    const result = evaluateQualityContract(PLATFORM_QUALITY_CONTRACT, {
      evalPassRate: 1,
      pilotSrPassRate: 1,
      waiterParityPassRate: 1,
      simLlmInvocationRate: 0.9,
      liveLlmInvocationRate: 0.5,
      refusalDetectionRate: 1,
      goldenRefusalRate: 0,
      scenarioCount: 10,
    });

    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.includes("live llm"))).toBe(true);
  });
});
