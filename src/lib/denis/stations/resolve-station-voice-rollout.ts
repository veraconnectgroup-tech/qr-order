import { isInCanaryCohort } from "@/lib/denis/config/rollout";

/**
 * ADR-053 rollout gate for the M1-M8 capability set — see the doc
 * comment on ConciergeStationQuestionsSchema.rollout for why this is a
 * separate axis from ConciergeRolloutSchema (guest-path-vs-kernel
 * ladder). Cohort key is locationId: a location either fully admits
 * station voice's capability set or it doesn't — there is no per-session
 * cohorting concept at a kitchen tablet the way there is for a guest's
 * table session.
 */
export function resolveStationVoiceRolloutEnabled(input: {
  mode: "off" | "shadow" | "live";
  canaryPercent: number;
  locationId: string | null | undefined;
}): boolean {
  if (input.mode === "off") return false;
  if (input.mode === "shadow") return false;
  if (!input.locationId) return false;
  return isInCanaryCohort(input.locationId, input.canaryPercent);
}
