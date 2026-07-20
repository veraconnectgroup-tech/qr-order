import { z } from "zod";

/**
 * Denis's own self-directed survey (founder directive: "extremely
 * proactive — surface things himself, track his own tasks"). Unlike every
 * other proactive mechanism in this codebase (fixed time-offset scheduler,
 * rule-based nudge triggers), this is the one place Denis genuinely looks
 * at unprompted venue state and decides for himself whether something
 * deserves a task — no guest message, no staff voice command, no fixed
 * threshold triggered this turn.
 *
 * needsAttention has no "always true" failure mode by design: the schema
 * forces a real either/or, and the prompt (assess-venue-survey.ts)
 * explicitly tells the model that "nothing right now" is the expected,
 * common answer — most ticks should find nothing, same as most guest
 * turns aren't conduct violations.
 */
export const VenueSurveyDecisionSchema = z.object({
  needsAttention: z.boolean(),
  /** Only meaningful when needsAttention is true. */
  title: z.string().max(120).nullable(),
  summary: z.string().max(500).nullable(),
  urgency: z.enum(["normal", "urgent"]).nullable(),
  /** Always populated — even "nothing" gets a one-line reason, for audit/tuning. */
  reasoning: z.string().max(300),
});

export type VenueSurveyDecision = z.infer<typeof VenueSurveyDecisionSchema>;

export type VenueSurveySnapshot = {
  locationId: string;
  kitchenQueueDepth: number;
  kitchenRushMode: boolean;
  barQueueDepth: number;
  overloadedStation: string | null;
  openMissionCount: number;
  openMissionTitles: string[];
  overdueCommitmentCount: number;
  activeTableCount: number;
};
