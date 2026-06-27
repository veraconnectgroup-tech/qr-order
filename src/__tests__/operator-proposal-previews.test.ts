import { describe, expect, it } from "vitest";
import { buildOperatorProposalPreview } from "@/lib/admin/build-operator-proposal-previews";
import type { OperatorConfigProposal } from "@/lib/operator/config-proposals";

function proposal(
  patch: Record<string, unknown>,
  kind: "config" | "playbook" = "config"
): OperatorConfigProposal {
  return {
    id: "prop-1",
    orgId: "org-1",
    locationId: "loc-1",
    kind,
    patch,
    reason: "test",
    status: "pending",
    createdByKeyId: "key-1",
    createdAt: "2026-06-27T12:00:00.000Z",
    reviewedAt: null,
  };
}

describe("buildOperatorProposalPreview", () => {
  it("summarizes config patch diff", () => {
    const preview = buildOperatorProposalPreview(
      {
        proactive: { enabled: false, browseNudgeMinutes: 3, billPromptMinutes: 45 },
      },
      proposal({
        proactive: { enabled: true, browseNudgeMinutes: 5 },
      })
    );

    expect(preview.diffLines.some((line) => line.includes("proactive.enabled"))).toBe(
      true
    );
    expect(
      preview.diffLines.some((line) => line.includes("proactive.browseNudgeMinutes"))
    ).toBe(true);
  });

  it("labels playbook proposals", () => {
    const preview = buildOperatorProposalPreview(null, proposal({ tone: "formal" }, "playbook"));
    expect(preview.diffLines[0]).toContain("Playbook patch keys");
  });
});
