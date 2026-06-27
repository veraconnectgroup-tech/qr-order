import type {
  PartialConciergeConfig,
  PilotCutoverStage,
} from "@/lib/denis/config/concierge-config.schema";
import { TABLE_OS_PILOT_CONFIG_PATCH } from "@/lib/denis/config/pilot-wiring";

export const PILOT_CUTOVER_STAGES: PilotCutoverStage[] = [
  "canary_10",
  "canary_50",
  "canary_100",
  "denis_only",
];

const STAGE_LABELS: Record<PilotCutoverStage, string> = {
  canary_10: "Canary 10%",
  canary_50: "Canary 50%",
  canary_100: "Canary 100%",
  denis_only: "Denis only (full cutover)",
};

export function pilotCutoverStageLabel(stage: PilotCutoverStage): string {
  return STAGE_LABELS[stage];
}

/** Table OS pilot patch for a ladder step — never skip canary (H1). */
export function buildPilotStagePatch(
  stage: PilotCutoverStage
): PartialConciergeConfig {
  const { rollout: _rollout, ...base } = TABLE_OS_PILOT_CONFIG_PATCH;

  switch (stage) {
    case "canary_10":
      return {
        ...base,
        version: 1,
        rollout: {
          mode: "canary",
          canaryPercent: 10,
          tableSessionActorEnabled: true,
        },
      };
    case "canary_50":
      return {
        ...base,
        version: 1,
        rollout: {
          mode: "canary",
          canaryPercent: 50,
          tableSessionActorEnabled: true,
        },
      };
    case "canary_100":
      return {
        ...base,
        version: 1,
        rollout: {
          mode: "canary",
          canaryPercent: 100,
          tableSessionActorEnabled: true,
        },
      };
    case "denis_only":
      return {
        ...base,
        version: 1,
        rollout: {
          mode: "denis_only",
          canaryPercent: 100,
          tableSessionActorEnabled: true,
        },
      };
  }
}

/** First cutover step when no pilot stage is active. */
export function initialPilotCutoverStage(): PilotCutoverStage {
  return "canary_10";
}

export function nextPilotCutoverStage(
  current: PilotCutoverStage | null | undefined
): PilotCutoverStage | null {
  if (!current) return initialPilotCutoverStage();
  const idx = PILOT_CUTOVER_STAGES.indexOf(current);
  if (idx < 0 || idx >= PILOT_CUTOVER_STAGES.length - 1) return null;
  return PILOT_CUTOVER_STAGES[idx + 1] ?? null;
}

export function inferPilotStageFromRollout(input: {
  mode: string;
  canaryPercent: number;
}): PilotCutoverStage | null {
  if (input.mode === "denis_only") return "denis_only";
  if (input.mode !== "canary") return null;
  if (input.canaryPercent >= 100) return "canary_100";
  if (input.canaryPercent >= 50) return "canary_50";
  if (input.canaryPercent >= 10) return "canary_10";
  return null;
}
