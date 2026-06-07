import type { InterventionManifest } from "@/lib/denis/cognition/intervention/intervention-types";
import { runInterventionManifestCompareSim } from "@/lib/denis/cognition/intervention/run-intervention-manifest-sim";
import type { InterventionManifestSimReport } from "@/lib/denis/cognition/intervention/run-intervention-manifest-sim";
import { getInterventionEnforceViolations } from "@/lib/denis/config/resolve-intervention-enforce-ready";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { lookupInterventionManifest } from "@/lib/denis/cognition/intervention/intervention-manifest-registry";
import type { InterventionManifestSimScenario } from "@/lib/denis/cognition/intervention/run-intervention-manifest-sim";

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Rule changes require timeline replay before promote (ADR-041 P3 / MR-8 pattern). */
export function interventionManifestRequiresTimelineSim(
  current: InterventionManifest | null,
  proposed: InterventionManifest
): boolean {
  if (!current) return false;
  return stableJson(current.rules) !== stableJson(proposed.rules);
}

export type InterventionManifestPromoteGateInput = {
  baseConfig: ConciergeConfig;
  currentManifestVersion: string | null;
  proposedManifestVersion: string;
  timelineReplayAvailable?: boolean;
  targetMode?: ConciergeConfig["intervention"]["mode"];
  /** ADR-041 P4 — deterministic fixture replay when rules change. */
  simScenarios?: InterventionManifestSimScenario[];
};

export type InterventionManifestPromoteGateResult = {
  ok: boolean;
  violations: string[];
  requiresTimelineSim: boolean;
  proposedManifest: InterventionManifest | null;
  simReport: InterventionManifestSimReport | null;
};

/** Gate intervention manifest promotion — version registry + sim + enforce pairing. */
export function evaluateInterventionManifestPromoteGate(
  input: InterventionManifestPromoteGateInput
): InterventionManifestPromoteGateResult {
  const violations: string[] = [];
  const proposedManifest = lookupInterventionManifest(
    input.proposedManifestVersion
  );

  if (!proposedManifest) {
    violations.push(`unknown intervention manifest: ${input.proposedManifestVersion}`);
    return {
      ok: false,
      violations,
      requiresTimelineSim: false,
      proposedManifest: null,
      simReport: null,
    };
  }

  const currentManifest = lookupInterventionManifest(input.currentManifestVersion);
  const requiresTimelineSim = interventionManifestRequiresTimelineSim(
    currentManifest,
    proposedManifest
  );

  let simReport: InterventionManifestSimReport | null = null;

  if (requiresTimelineSim) {
    if (!input.timelineReplayAvailable && !input.simScenarios?.length) {
      violations.push(
        "timeline sim required: replay proactive ticks before promoting intervention rules"
      );
    } else if (input.simScenarios?.length) {
      simReport = runInterventionManifestCompareSim({
        baseline: currentManifest ?? proposedManifest,
        proposed: proposedManifest,
        scenarios: input.simScenarios,
        baselineLabel: input.currentManifestVersion ?? "platform",
        proposedLabel: input.proposedManifestVersion,
      });
      if (!simReport.ok) {
        violations.push(...simReport.regressions);
      }
    }
  }

  const targetMode = input.targetMode ?? input.baseConfig.intervention.mode;
  if (targetMode === "enforce") {
    violations.push(...getInterventionEnforceViolations(input.baseConfig));
  }

  return {
    ok: violations.length === 0,
    violations,
    requiresTimelineSim,
    proposedManifest,
    simReport,
  };
}
