import {
  parsePartialConciergeConfig,
  type PartialConciergeConfig,
} from "@/lib/denis/config/concierge-config.schema";
import { mergePartialConciergeConfig } from "@/lib/denis/config/merge-concierge-config";
import {
  diffConciergeConfig,
  summarizeConfigDiff,
} from "@/lib/denis/config/config-versioning";
import type { OperatorConfigProposal } from "@/lib/operator/config-proposals";

export type OperatorProposalPreview = {
  proposalId: string;
  diffLines: string[];
};

export function buildOperatorProposalPreview(
  currentConfig: PartialConciergeConfig | null | undefined,
  proposal: OperatorConfigProposal
): OperatorProposalPreview {
  if (proposal.kind !== "config") {
    const keys = Object.keys(proposal.patch);
    return {
      proposalId: proposal.id,
      diffLines: [
        keys.length > 0
          ? `Playbook patch keys: ${keys.slice(0, 8).join(", ")}`
          : "Empty playbook patch",
      ],
    };
  }

  const patch = parsePartialConciergeConfig(proposal.patch);
  if (!patch) {
    return {
      proposalId: proposal.id,
      diffLines: ["Invalid config patch JSON"],
    };
  }

  const merged = mergePartialConciergeConfig(currentConfig, patch);
  const diff = diffConciergeConfig(currentConfig, merged);
  const diffLines = summarizeConfigDiff(diff);

  return {
    proposalId: proposal.id,
    diffLines:
      diffLines.length > 0 ? diffLines : ["No effective config changes"],
  };
}

export function buildOperatorProposalPreviews(
  configByLocationId: Map<string, PartialConciergeConfig | null>,
  proposals: OperatorConfigProposal[]
): OperatorProposalPreview[] {
  return proposals.map((proposal) =>
    buildOperatorProposalPreview(
      configByLocationId.get(proposal.locationId) ?? null,
      proposal
    )
  );
}
