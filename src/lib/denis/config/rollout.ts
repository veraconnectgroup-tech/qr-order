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
  /** M27 — share of table sessions on Denis guest path when mode=canary. */
  canaryPercent: z.number().int().min(0).max(100).default(10),
});

export type ConciergeRollout = z.infer<typeof ConciergeRolloutSchema>;

export type GuestLegacyPathOptions = {
  /** Stable cohort key (e.g. QR session token). */
  cohortKey?: string | null;
  canaryPercent?: number;
};

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
    return {
      mode: envMode,
      canaryPercent: config.rollout.canaryPercent ?? 10,
    };
  }
  return config.rollout;
}

/** Stable 0–99 bucket from cohort key (M27). */
export function canaryCohortBucket(cohortKey: string): number {
  let hash = 0;
  for (let i = 0; i < cohortKey.length; i++) {
    hash = (hash * 31 + cohortKey.charCodeAt(i)) >>> 0;
  }
  return hash % 100;
}

export function isInCanaryCohort(
  cohortKey: string,
  canaryPercent: number
): boolean {
  if (canaryPercent <= 0) return false;
  if (canaryPercent >= 100) return true;
  return canaryCohortBucket(cohortKey) < canaryPercent;
}

/** Whether this turn serves legacy guest-visible chat (M10/M27). */
export function resolveGuestLegacyPath(
  mode: ConciergeRolloutMode,
  options?: GuestLegacyPathOptions
): boolean {
  if (mode === "legacy" || mode === "shadow") return true;
  if (mode === "denis_only") return false;
  if (mode === "simulation") return true;
  if (mode === "canary") {
    const key = options?.cohortKey?.trim();
    const percent = options?.canaryPercent ?? 0;
    if (!key) return true;
    return !isInCanaryCohort(key, percent);
  }
  return true;
}

/** @deprecated Use resolveGuestLegacyPath — mode-only shortcut. */
export function guestSeesLegacyPath(mode: ConciergeRolloutMode): boolean {
  return resolveGuestLegacyPath(mode);
}

export function kernelTimelineEnabled(mode: ConciergeRolloutMode): boolean {
  return mode !== "legacy";
}

export function shouldRunShadowDiff(mode: ConciergeRolloutMode): boolean {
  return mode === "shadow" || mode === "simulation";
}
