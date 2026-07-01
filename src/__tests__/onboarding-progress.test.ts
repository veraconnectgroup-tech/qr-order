import { describe, expect, it } from "vitest";
import {
  buildTableNames,
  computeOnboardingCompletionPercent,
  emptyOnboardingProgress,
  markStepCompleted,
  markStepSkipped,
  ONBOARDING_STEP_IDS,
} from "@/lib/dashboard/onboarding-progress";

describe("onboarding progress", () => {
  it("tracks completion percent across nine steps", () => {
    expect(computeOnboardingCompletionPercent(emptyOnboardingProgress())).toBe(0);

    let progress = emptyOnboardingProgress();
    for (const stepId of ONBOARDING_STEP_IDS) {
      progress = markStepCompleted(progress, stepId);
    }

    expect(computeOnboardingCompletionPercent(progress)).toBe(100);
  });

  it("counts skipped steps toward progress", () => {
    const progress = markStepSkipped(emptyOnboardingProgress(), "stripe");
    expect(computeOnboardingCompletionPercent(progress)).toBe(
      Math.round((1 / ONBOARDING_STEP_IDS.length) * 100)
    );
  });

  it("builds table names for numbering schemes", () => {
    expect(buildTableNames(3, "table_n")).toEqual(["Table 1", "Table 2", "Table 3"]);
    expect(buildTableNames(2, "t_n")).toEqual(["T1", "T2"]);
    expect(buildTableNames(2, "numeric")).toEqual(["1", "2"]);
  });
});
