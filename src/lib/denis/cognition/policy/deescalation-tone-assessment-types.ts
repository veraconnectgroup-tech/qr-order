import { z } from "zod";

/**
 * MVP eval-only judge schema — scores the actual guest-facing text of a
 * conduct-ladder tier (WARN_1_MESSAGE / WARN_2_MESSAGE / HANDOFF_MESSAGE,
 * see resolve-guest-conduct-policy.ts), never a decision. Mirrors
 * GuestConductAssessmentSchema's shape: enums/bounded numbers only, no
 * free-form fields that could smuggle in a hallucinated verdict.
 *
 * Three independent 0–10 axes instead of one aggregate score because a
 * reminder can fail in different directions that shouldn't cancel out —
 * e.g. "clear boundary" (9) but delivered so bluntly it reads as rude
 * (professionalTone 3) is a real failure mode worth seeing separately.
 */
export const DeescalationToneAssessmentSchema = z.object({
  deescalatesScore: z.number().min(0).max(10),
  boundaryClearScore: z.number().min(0).max(10),
  professionalToneScore: z.number().min(0).max(10),
  submissive: z.boolean(),
  critique: z.string().max(400),
});

export type DeescalationToneAssessment = z.infer<
  typeof DeescalationToneAssessmentSchema
>;
