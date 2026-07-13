import type { RuleCandidateAssessment } from "@/lib/denis/cognition/policy/rule-classification-types";

export type RuleProposalAction = "none" | "propose_pending";

const MIN_CONFIDENCE_TO_PROPOSE = 0.55;

/**
 * Deterministic — turns the LLM's own structured perception into a
 * decision, never the other way around. Per the founder's own decision
 * (00167 migration comment): a colleague's answer is NEVER enough on its
 * own to durably change house knowledge, no matter who said it or how
 * confident the extraction — every "permanent"/"unclear" candidate always
 * lands in pending_confirmation, requiring explicit owner/manager
 * sign-off. "one_time" candidates are never proposed as durable knowledge
 * at all (Denis may still apply the answer for the current order — a
 * timeline-logged one-time application, not a knowledge-table write, and
 * not this function's concern).
 */
export function resolveRuleProposalPolicy(
  assessment: RuleCandidateAssessment | null
): RuleProposalAction {
  if (!assessment) return "none";
  if (!assessment.present || !assessment.ruleText) return "none";
  if (assessment.confidence < MIN_CONFIDENCE_TO_PROPOSE) return "none";
  if (assessment.scopeClaim === "one_time") return "none";
  return "propose_pending";
}
