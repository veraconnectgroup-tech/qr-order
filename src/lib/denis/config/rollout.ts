import { z } from "zod";

/** ADR-006 rollout ladder — guest path vs kernel path. */
export const ConciergeRolloutModeSchema = z.enum([
  "legacy",
  "shadow",
  "canary",
  "denis_only",
  "simulation",
]);

export type ConciergeRolloutMode = z.infer<typeof ConciergeRolloutModeSchema>;

export const ConciergeRolloutSchema = z.object({
  mode: ConciergeRolloutModeSchema,
});

export type ConciergeRollout = z.infer<typeof ConciergeRolloutSchema>;

const ENV_ROLLOUT_OVERRIDE = "DENIS_ROLLOUT_MODE";

export function parseRolloutModeFromEnv(): ConciergeRolloutMode | null {
  const raw = process.env[ENV_ROLLOUT_OVERRIDE]?.trim();
  if (!raw) return null;
  const parsed = ConciergeRolloutModeSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Effective rollout — env override wins for platform ops (M10). */
export function resolveEffectiveRollout(config: {
  rollout: ConciergeRollout;
}): ConciergeRollout {
  const envMode = parseRolloutModeFromEnv();
  if (envMode) {
    return { mode: envMode };
  }
  return config.rollout;
}

export function guestSeesLegacyPath(mode: ConciergeRolloutMode): boolean {
  return mode === "legacy" || mode === "shadow";
}

export function kernelTimelineEnabled(mode: ConciergeRolloutMode): boolean {
  return mode !== "legacy";
}

export function shouldRunShadowDiff(mode: ConciergeRolloutMode): boolean {
  return mode === "shadow" || mode === "simulation";
}
