import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type PilotCutoverStage =
  | "canary_10"
  | "canary_50"
  | "canary_100"
  | "denis_only";

export function initialPilotCutoverStage(): PilotCutoverStage {
  return "canary_10";
}

export function nextPilotCutoverStage(
  current: PilotCutoverStage | null
): PilotCutoverStage | null {
  if (current == null) return "canary_10";
  if (current === "canary_10") return "canary_50";
  if (current === "canary_50") return "canary_100";
  if (current === "canary_100") return "denis_only";
  return null;
}

export function buildPilotStagePatch(
  stage: PilotCutoverStage
): Partial<ConciergeConfig> {
  if (stage === "denis_only") {
    return { rollout: { mode: "denis_only", canaryPercent: 100 } } as Partial<ConciergeConfig>;
  }
  const canaryPercent =
    stage === "canary_10" ? 10 : stage === "canary_50" ? 50 : 100;
  return { rollout: { mode: "canary", canaryPercent } } as Partial<ConciergeConfig>;
}
