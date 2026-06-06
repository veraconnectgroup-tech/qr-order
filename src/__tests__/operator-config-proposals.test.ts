import { describe, expect, it } from "vitest";
import {
  parseConfigProposalBody,
  parsePlaybookProposalBody,
} from "@/lib/operator/config-proposals";

describe("operator config proposals parsing", () => {
  it("parses valid config proposal body", () => {
    const parsed = parseConfigProposalBody({
      locationId: "550e8400-e29b-41d4-a716-446655440000",
      patch: { persona: { tone: "warm_short" } },
      reason: "Improve greeting conversion",
    });
    expect(parsed?.locationId).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(parsed?.reason).toBe("Improve greeting conversion");
    expect(parsed?.patch.persona?.tone).toBe("warm_short");
  });

  it("rejects invalid config patch", () => {
    expect(
      parseConfigProposalBody({
        locationId: "550e8400-e29b-41d4-a716-446655440000",
        patch: { persona: { tone: "invalid_tone" } },
        reason: "Bad",
      })
    ).toBeNull();
  });

  it("parses playbook proposal body", () => {
    const parsed = parsePlaybookProposalBody({
      locationId: "550e8400-e29b-41d4-a716-446655440000",
      examples: [
        {
          user_message: "Može",
          assistant_message: "Naravno — šta želite?",
        },
      ],
      reason: "Add recap confirm example",
    });
    expect(parsed?.examples).toHaveLength(1);
    expect(parsed?.reason).toContain("recap");
  });
});
