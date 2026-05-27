import { describe, expect, it } from "vitest";
import { runEvalSuiteAndMaybePersist } from "@/lib/denis/eval/record-eval-suite";

describe("Denis record eval suite M26", () => {
  it("runs suite without persist when admin omitted", async () => {
    const { report, persisted } = await runEvalSuiteAndMaybePersist({
      skipPersist: true,
    });
    expect(report.scenarioCount).toBeGreaterThan(0);
    expect(persisted).toBeNull();
  });
});
