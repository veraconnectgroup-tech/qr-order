import { z } from "zod";

/**
 * MVP-3 (Architecture Proposal §16 step 3) — LLM assessment only, never a
 * decision. The regex layer (abuse-protection.ts) catches heavy profanity;
 * this catches milder rudeness regex can't ("glup si", "ćuti govno" etc.)
 * that's still genuinely directed at Denis. resolve-guest-conduct-policy.ts
 * is still the only thing that decides what happens — this schema has no
 * consequence fields on purpose (no "action", no "shouldWarn").
 */
export const GuestConductAssessmentSchema = z.object({
  toneTowardDenis: z.enum([
    "respectful",
    "curt",
    "mild_insult",
    "severe_insult",
    "threat",
  ]),
  directedAt: z.enum(["denis", "service", "unclear"]),
  confidence: z.number().min(0).max(1),
  /** Exact substring that drove the classification — audit trail, prevents hallucinated justification. */
  quotedSpan: z.string().max(300),
});

export type GuestConductAssessment = z.infer<
  typeof GuestConductAssessmentSchema
>;
