import { z } from "zod";

/**
 * Generic eval-only judge schema shared by the multilingual-quality eval
 * (run-multilingual-quality-eval.ts) and the voice-turn quality eval
 * (run-voice-turn-quality-eval.ts). Both are fundamentally the same
 * question — "does this specific Denis reply read as a natural, competent
 * answer for its context" — differing only in what "context" means (a
 * guest chatting in French vs. a cook mid-service on a wake-word mic), so
 * one schema + one rubric-driven judge avoids two near-duplicate files.
 */
export const ReplyQualityAssessmentSchema = z.object({
  score: z.number().min(0).max(10),
  meetsBar: z.boolean(),
  issues: z.array(z.string().max(200)).max(5),
  critique: z.string().max(400),
});

export type ReplyQualityAssessment = z.infer<
  typeof ReplyQualityAssessmentSchema
>;
