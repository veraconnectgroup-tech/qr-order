/** ADR-006 risk classes — every skill/action declares one (M3+ registry). */
export const DENIS_RISK_CLASSES = ["R0", "R1", "R2", "R3", "R4", "R5"] as const;

export type DenisRiskClass = (typeof DENIS_RISK_CLASSES)[number];

export type RolloutMode =
  | "simulation"
  | "shadow"
  | "staff_only"
  | "cohort"
  | "live";

export const DEFAULT_ROLLOUT_MODE: RolloutMode = "live";

/** Whether rollout mode allows executing actions at a given risk class. */
export function isRiskClassAllowedInRollout(
  mode: RolloutMode,
  riskClass: DenisRiskClass
): boolean {
  switch (mode) {
    case "simulation":
      return true;
    case "shadow":
      return true;
    case "staff_only":
      return riskClass === "R0" || riskClass === "R3";
    case "cohort":
    case "live":
      return true;
    default:
      return false;
  }
}

/** Map cognitive tier to default risk for narration path. */
export function defaultRiskForNarrationTier(
  tier: "template" | "T3"
): DenisRiskClass {
  return tier === "template" ? "R0" : "R0";
}
