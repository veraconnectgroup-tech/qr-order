import { describe, expect, it } from "vitest";
import { evaluateGaGate } from "@/lib/denis/runtime/ga-gate";
import type { DenisRolloutFormState } from "@/lib/denis/config/rollout-cutover";

function baseForm(
  overrides: Partial<DenisRolloutFormState> = {}
): DenisRolloutFormState {
  return {
    rolloutMode: "shadow",
    canaryPercent: 10,
    narrateWithLlm: false,
    slotExtractEnabled: true,
    slotExtractWithLlm: false,
    returnGuestEnabled: false,
    voiceEnabled: false,
    actLayerEnabled: false,
    actDryRun: true,
    actSubmitEnabled: false,
    legacyOrderingEnabled: true,
    ...overrides,
  };
}

describe("evaluateGaGate", () => {
  it("recommends shadow as next step from legacy", () => {
    const report = evaluateGaGate(baseForm({ rolloutMode: "legacy" }));
    expect(report.recommendedNextMode).toBe("shadow");
    expect(report.checks.some((c) => c.id === "legacy-exit")).toBe(true);
  });

  it("blocks denis_only without narrateWithLlm", () => {
    const report = evaluateGaGate(
      baseForm({ rolloutMode: "denis_only", narrateWithLlm: false })
    );
    expect(report.ready).toBe(false);
    expect(
      report.checks.find((c) => c.id === "narrate-with-llm")?.passed
    ).toBe(false);
  });

  it("passes denis_only when narrate on and parity ≥ 99", () => {
    const report = evaluateGaGate(
      baseForm({ rolloutMode: "denis_only", narrateWithLlm: true }),
      { shadowParityPct: 99.2 }
    );
    expect(report.ready).toBe(true);
  });

  it("blocks live act submit without eval pass", () => {
    const report = evaluateGaGate(
      baseForm({
        rolloutMode: "denis_only",
        narrateWithLlm: true,
        actLayerEnabled: true,
        actDryRun: false,
        actSubmitEnabled: true,
      }),
      { shadowParityPct: 100, recentEvalPass: false }
    );
    expect(report.ready).toBe(false);
    expect(report.checks.find((c) => c.id === "eval-green")?.passed).toBe(
      false
    );
  });

  it("passes live act submit when eval green", () => {
    const report = evaluateGaGate(
      baseForm({
        rolloutMode: "denis_only",
        narrateWithLlm: true,
        actLayerEnabled: true,
        actDryRun: false,
        actSubmitEnabled: true,
      }),
      { shadowParityPct: 100, recentEvalPass: true }
    );
    expect(report.ready).toBe(true);
  });
});
