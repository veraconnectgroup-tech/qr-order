import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { mergeManifestConfig } from "@/lib/denis/cognition/manifest/merge-manifest-config";
import {
  parseVenueManifest,
  type VenueManifest,
} from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import {
  runQualityContractEval,
  type QualityContractEvalResult,
} from "@/lib/denis/cognition/quality/contract-eval";
import { runManifestCompareSim } from "@/lib/denis/eval/run-venue-sim";
import type { VenueSimReport } from "@/lib/denis/eval/venue-sim-types";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

export type ManifestHistoryEntry = {
  version: number;
  manifest: VenueManifest;
  promotedAt: string;
};

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

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Policy/capability changes require timeline replay before promote (MR-8). */
export function manifestRequiresTimelineSim(
  current: VenueManifest | null,
  proposed: VenueManifest
): boolean {
  if (!current) return false;
  return (
    stableJson(current.policy) !== stableJson(proposed.policy) ||
    stableJson(current.capabilities) !== stableJson(proposed.capabilities)
  );
}

export function evaluateSimRegression(simReport: VenueSimReport): string[] {
  const violations: string[] = [];
  const { delta, counterfactual } = simReport.metrics;

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

export function extractManifestFromStorage(raw: unknown): VenueManifest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  return parseVenueManifest(
    row.venue_manifest ?? row.venueManifest ?? row.manifest ?? null
  );
}

export function extractManifestHistory(raw: unknown): ManifestHistoryEntry[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const row = raw as Record<string, unknown>;
  const denis = row.denis;
  if (!denis || typeof denis !== "object" || Array.isArray(denis)) return [];
  const history = (denis as Record<string, unknown>).manifestHistory;
  if (!Array.isArray(history)) return [];

  return history
    .map((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
      const rowEntry = entry as Record<string, unknown>;
      const manifest = parseVenueManifest(rowEntry.manifest);
      const version =
        typeof rowEntry.version === "number" ? rowEntry.version : null;
      const promotedAt =
        typeof rowEntry.promotedAt === "string" ? rowEntry.promotedAt : null;
      if (!manifest || version === null || !promotedAt) return null;
      return { version, manifest, promotedAt };
    })
    .filter((entry): entry is ManifestHistoryEntry => entry !== null)
    .sort((a, b) => b.version - a.version);
}

export function buildPromotedStoragePatch(input: {
  existingRaw: unknown;
  manifest: VenueManifest;
  historyEntry: ManifestHistoryEntry;
}): Record<string, unknown> {
  const existing =
    input.existingRaw &&
    typeof input.existingRaw === "object" &&
    !Array.isArray(input.existingRaw)
      ? { ...(input.existingRaw as Record<string, unknown>) }
      : {};

  const history = extractManifestHistory(existing);
  const nextHistory = [
    input.historyEntry,
    ...history.filter((row) => row.version !== input.historyEntry.version),
  ].slice(0, 10);

  const denis =
    existing.denis &&
    typeof existing.denis === "object" &&
    !Array.isArray(existing.denis)
      ? { ...(existing.denis as Record<string, unknown>) }
      : {};

  return {
    ...existing,
    venue_manifest: input.manifest,
    denis: {
      ...denis,
      manifestHistory: nextHistory,
      lastPromotedAt: input.historyEntry.promotedAt,
      activeManifestVersion: input.historyEntry.version,
    },
  };
}

export function buildRollbackStoragePatch(input: {
  existingRaw: unknown;
  rollbackManifest: VenueManifest;
  rollbackVersion: number;
}): Record<string, unknown> {
  const existing =
    input.existingRaw &&
    typeof input.existingRaw === "object" &&
    !Array.isArray(input.existingRaw)
      ? { ...(input.existingRaw as Record<string, unknown>) }
      : {};

  const denis =
    existing.denis &&
    typeof existing.denis === "object" &&
    !Array.isArray(existing.denis)
      ? { ...(existing.denis as Record<string, unknown>) }
      : {};

  return {
    ...existing,
    venue_manifest: input.rollbackManifest,
    denis: {
      ...denis,
      activeManifestVersion: input.rollbackVersion,
      lastRollbackAt: new Date().toISOString(),
    },
  };
}
