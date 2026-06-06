import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { mergeManifestConfig } from "@/lib/denis/cognition/manifest/merge-manifest-config";
import type { VenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import { manifestRequiresTimelineSim } from "@/lib/denis/cognition/manifest/manifest-promote-gate";
import {
  runQualityContractEval,
  type QualityContractEvalResult,
} from "@/lib/denis/eval/quality-contract-eval";
import { runManifestCompareSim } from "@/lib/denis/eval/run-venue-sim";
import type { VenueSimReport } from "@/lib/denis/eval/venue-sim-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type ManifestPromoteGateInput = {
  baseConfig: ConciergeConfig;
  currentManifest: VenueManifest | null;
  proposedManifest: VenueManifest;
  timelineEvents?: DenisTimelineRow[];
  simSessionId?: string | null;
};

export type ManifestPromoteGateResult = {
  ok: boolean;
  blocked: boolean;
  violations: string[];
  requiresTimelineSim: boolean;
  qualityContract: QualityContractEvalResult;
  simReport: VenueSimReport | null;
  nextVersion: number;
};

export function evaluateSimRegression(simReport: VenueSimReport): string[] {
  const violations: string[] = [];
  const { delta } = simReport.metrics;

  if (delta.conflictTurns > 0) {
    violations.push(
      `sim regression: conflict turns increased by ${delta.conflictTurns}`
    );
  }

  const confirmRegressions = simReport.turns.filter(
    (turn) =>
      turn.flowNodeId === "recap" &&
      turn.baseline.usedT0 &&
      !turn.counterfactual.usedT0
  );
  if (confirmRegressions.length > 0) {
    violations.push(
      `sim regression: ${confirmRegressions.length} recap confirm turn(s) lost T0 reflex`
    );
  }

  return violations;
}

export function evaluateManifestPromoteGate(
  input: ManifestPromoteGateInput
): ManifestPromoteGateResult {
  const violations: string[] = [];
  const requiresTimelineSim = manifestRequiresTimelineSim(
    input.currentManifest,
    input.proposedManifest
  );

  const qualityContract = runQualityContractEval(
    input.proposedManifest.qualityContract ?? null
  );
  if (!qualityContract.ok) {
    violations.push(...qualityContract.violations);
  }

  let simReport: VenueSimReport | null = null;

  if (requiresTimelineSim) {
    if (!input.timelineEvents?.length || !input.simSessionId) {
      violations.push(
        "timeline sim required: record a Denis session (shadow/denis_only) and replay before promote"
      );
    } else {
      const baselineEffective = mergeManifestConfig(
        input.baseConfig,
        input.currentManifest
      );
      const proposedEffective = mergeManifestConfig(
        input.baseConfig,
        input.proposedManifest
      );

      const currentVersion = input.currentManifest?.manifestVersion ?? 0;
      const proposedVersion = input.proposedManifest.manifestVersion;

      simReport = runManifestCompareSim(
        input.simSessionId,
        input.timelineEvents,
        baselineEffective.config,
        proposedEffective.config,
        {
          baseline: `manifest v${currentVersion}`,
          counterfactual: `manifest v${proposedVersion}`,
        }
      );

      if (simReport.turns.length === 0) {
        violations.push("timeline sim has no guest turns to replay");
      } else {
        violations.push(...evaluateSimRegression(simReport));
      }
    }
  }

  const nextVersion = (input.currentManifest?.manifestVersion ?? 0) + 1;

  return {
    ok: violations.length === 0,
    blocked: violations.length > 0,
    violations,
    requiresTimelineSim,
    qualityContract,
    simReport,
    nextVersion,
  };
}
