import type { ParsedApiSpec } from "@/lib/denis/integrations/parsers/parsed-api-spec-types";
import { matchCapabilityHeuristic } from "@/lib/denis/integrations/capabilities/match-capability-heuristic";
import { discoverEndpointCapability } from "@/lib/denis/cognition/perceive/discover-endpoint-capability";
import type { CapabilityProposal } from "@/lib/denis/integrations/capabilities/denis-capability-types";

/**
 * ADR-052 §C step 4/5 — heuristic-first, LLM-fallback-only. Never calls
 * the LLM for an endpoint the deterministic matcher already resolved
 * confidently; only reaches for it on the genuinely ambiguous remainder,
 * keeping cost/latency down and keeping the deterministic path as the
 * primary source of truth per ADR-052 §1.
 */
export async function discoverApiCapabilities(
  spec: ParsedApiSpec
): Promise<CapabilityProposal[]> {
  const proposals: CapabilityProposal[] = [];

  for (const endpoint of spec.endpoints) {
    const heuristicMatch = matchCapabilityHeuristic(endpoint);
    if (heuristicMatch) {
      proposals.push(heuristicMatch);
      continue;
    }

    const llmAssessment = await discoverEndpointCapability({
      method: endpoint.method,
      path: endpoint.path,
      operationId: endpoint.operationId,
      summary: endpoint.summary,
      description: endpoint.description,
    });

    if (!llmAssessment || llmAssessment.capability === "none") continue;

    proposals.push({
      capability: llmAssessment.capability,
      status: "supported",
      endpoint: `${endpoint.method} ${endpoint.path}`,
      quotedSpan: llmAssessment.quotedSpan,
      source: "llm",
      confidence: llmAssessment.confidence,
    });
  }

  return proposals;
}
