import { describe, expect, it } from "vitest";
import {
  formatRegionalSubstitutionBlock,
  resolveRegionalSubstitutionPriors,
} from "@/lib/denis/learning/substitution-patterns";

describe("cross-venue substitution patterns (Prompt 48)", () => {
  it("German venues inherit glutenfrei awareness", () => {
    const priors = resolveRegionalSubstitutionPriors("DE");
    expect(priors[0]?.token).toBe("glutenfrei");

    const block = formatRegionalSubstitutionBlock("DE", "de");
    expect(block).toContain("glutenfrei");
    expect(block).toContain("cross-venue");
  });

  it("returns empty for unknown regions", () => {
    expect(resolveRegionalSubstitutionPriors("US")).toEqual([]);
    expect(formatRegionalSubstitutionBlock("US")).toBeNull();
  });
});
