import {
  resolveConfirmationRequired,
  resolveSideEffectLevel,
  type CapabilityManifest,
  type CapabilityProposal,
  type CapabilityRecord,
} from "@/lib/denis/integrations/capabilities/denis-capability-types";

const MIN_CONFIDENCE_TO_MARK_SUPPORTED = 0.55;

/**
 * ADR-052 §D — the one deterministic enforcement point every proposal
 * (heuristic or LLM) must pass through before it can be recorded as
 * "supported". The LLM/heuristic layer PROPOSES; this function DECIDES —
 * same "propose, never decide" split used everywhere else in this
 * codebase (ACL, Guest Conduct Policy Engine, reflex-plan.ts).
 *
 * Two hard rules, both non-negotiable:
 *  1. A capability can never end up "supported"/"supported_with_limitations"
 *     without a non-empty quotedSpan — a citation back to the source
 *     document, never a bare assertion.
 *  2. A proposal below MIN_CONFIDENCE_TO_MARK_SUPPORTED is downgraded to
 *     "unknown" — low-confidence LLM guesses never silently become a
 *     claimed capability.
 */
function enforceProposal(proposal: CapabilityProposal): CapabilityRecord {
  const sideEffectLevel = resolveSideEffectLevel(proposal.capability);
  const hasCitation = Boolean(proposal.quotedSpan?.trim());
  const meetsConfidenceBar =
    proposal.confidence >= MIN_CONFIDENCE_TO_MARK_SUPPORTED;

  const status =
    proposal.status === "supported" && hasCitation && meetsConfidenceBar
      ? "supported"
      : "unknown";

  return {
    capability: proposal.capability,
    status,
    endpoint: status === "unknown" ? null : proposal.endpoint,
    sideEffectLevel,
    confirmationRequired: resolveConfirmationRequired(sideEffectLevel),
    quotedSpan: status === "unknown" ? null : proposal.quotedSpan,
    knownLimitations: [],
  };
}

/**
 * Multiple proposals can target the same capability (e.g. two endpoints
 * both look like "order.status.read"). Keeps the single best-evidenced
 * one — highest confidence, heuristic preferred over LLM on a tie since
 * it's grounded in exact structure rather than model judgment.
 */
function pickBestProposal(
  proposals: CapabilityProposal[]
): CapabilityProposal {
  return proposals.reduce((best, candidate) => {
    if (candidate.confidence > best.confidence) return candidate;
    if (candidate.confidence === best.confidence && best.source === "llm" && candidate.source === "heuristic") {
      return candidate;
    }
    return best;
  });
}

export function mapCapabilities(
  provider: string,
  proposals: CapabilityProposal[]
): CapabilityManifest {
  const byCapability = new Map<string, CapabilityProposal[]>();
  for (const proposal of proposals) {
    const existing = byCapability.get(proposal.capability) ?? [];
    existing.push(proposal);
    byCapability.set(proposal.capability, existing);
  }

  const records = Array.from(byCapability.values())
    .map(pickBestProposal)
    .map(enforceProposal);

  return { provider, records };
}
