import { isInCanaryCohort } from "@/lib/denis/config/rollout";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";

export type AgenticTurnPolicy =
  | { mode: "off" }
  | { mode: "shadow" }
  | {
      mode: "live";
      dryRun: false;
      legacySingleCallFallback: boolean;
    };

export function resolveAgenticTurnPolicy(
  config: ConciergeConfig,
  cohortKey: string
): AgenticTurnPolicy {
  const agentic = config.ops.agenticToolLoop;
  if (!agentic.enabled) return { mode: "off" };
  if (!isInCanaryCohort(cohortKey, agentic.canaryPercent)) return { mode: "off" };
  if (agentic.shadowOnly) return { mode: "shadow" };
  return {
    mode: "live",
    dryRun: false,
    legacySingleCallFallback: agentic.legacySingleCallFallback,
  };
}

export function agenticUsesLegacySingleCallFallback(
  config: ConciergeConfig
): boolean {
  const agentic = config.ops.agenticToolLoop;
  return (
    agentic.enabled &&
    !agentic.shadowOnly &&
    agentic.canaryPercent >= 100 &&
    !agentic.legacySingleCallFallback
  );
}
