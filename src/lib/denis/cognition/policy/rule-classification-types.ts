import { z } from "zod";

/**
 * Architecture Proposal §1/§7 — genuine LLM extraction of a rule candidate
 * from a colleague's free-text answer to Denis. Never decides persistence
 * (that's resolve-rule-proposal-policy.ts, pure and deterministic) — only
 * observes whether the answer contained something worth remembering and
 * whether the speaker implied it's a standing rule or a one-off exception.
 */
export const RuleCandidateAssessmentSchema = z.object({
  /** True only if the answer contains a genuine fact/rule worth remembering — not smalltalk or a one-off status update. */
  present: z.boolean(),
  /** The rule/fact itself, phrased as a standing house-knowledge statement — null when present is false. */
  ruleText: z.string().max(500).nullable(),
  /** How the speaker implied this applies — their own wording, not inferred beyond what they said. */
  scopeClaim: z.enum(["permanent", "one_time", "unclear"]),
  confidence: z.number().min(0).max(1),
  /** Exact substring that justified the extraction — audit trail. */
  quotedSpan: z.string().max(300),
});

export type RuleCandidateAssessment = z.infer<
  typeof RuleCandidateAssessmentSchema
>;
