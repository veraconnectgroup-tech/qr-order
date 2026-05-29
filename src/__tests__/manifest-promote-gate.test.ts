import { describe, expect, it } from "vitest";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  evaluateManifestPromoteGate,
  evaluateSimRegression,
  manifestRequiresTimelineSim,
  buildPromotedStoragePatch,
  extractManifestHistory,
} from "@/lib/denis/cognition/manifest/manifest-promote-gate";
import type { VenueManifest } from "@/lib/denis/cognition/manifest/venue-manifest.schema";
import type { VenueSimReport } from "@/lib/denis/eval/venue-sim-types";

const baseManifest: VenueManifest = {
  manifestVersion: 1,
  capabilities: {
    relational: 3,
    transactional: 4,
    catalogRag: 2,
    guestMemory: 2,
    anticipation: 2,
  },
  policy: {
    requireExplicitConfirm: true,
    rushSkipUpsell: false,
    maxUpsellsPerSession: 2,
  },
  qualityContract: {
    refusalRateMax: 0,
    evalPassMin: 1,
    shadowParityMin: 0.99,
    llmInvocationMax: 0.35,
  },
};

describe("ADR-031 C5 manifest promote gate", () => {
  it("first manifest promote does not require timeline sim", () => {
    expect(manifestRequiresTimelineSim(null, baseManifest)).toBe(false);
  });

  it("policy change requires timeline sim", () => {
    const proposed: VenueManifest = {
      ...baseManifest,
      policy: { ...baseManifest.policy!, rushSkipUpsell: true },
    };
    expect(manifestRequiresTimelineSim(baseManifest, proposed)).toBe(true);
  });

  it("passes eval-only gate for first manifest", () => {
    const gate = evaluateManifestPromoteGate({
      baseConfig: CONCIERGE_PLATFORM_DEFAULTS,
      currentManifest: null,
      proposedManifest: baseManifest,
    });
    expect(gate.requiresTimelineSim).toBe(false);
    expect(gate.ok).toBe(true);
  });

  it("blocks policy change without timeline session", () => {
    const proposed: VenueManifest = {
      ...baseManifest,
      policy: { ...baseManifest.policy!, rushSkipUpsell: true },
    };
    const gate = evaluateManifestPromoteGate({
      baseConfig: CONCIERGE_PLATFORM_DEFAULTS,
      currentManifest: baseManifest,
      proposedManifest: proposed,
    });
    expect(gate.ok).toBe(false);
    expect(gate.violations.some((v) => v.includes("timeline sim required"))).toBe(
      true
    );
  });

  it("flags conflict regression in sim report", () => {
    const simReport = {
      sessionId: "s1",
      baselineLabel: "v1",
      counterfactualLabel: "v2",
      turns: [],
      metrics: {
        baseline: {
          turnCount: 2,
          t0Hits: 1,
          upsellGoals: 0,
          conflictTurns: 0,
          upsellFlowTransitions: 0,
          plannerChangedTurns: 0,
        },
        counterfactual: {
          turnCount: 2,
          t0Hits: 1,
          upsellGoals: 0,
          conflictTurns: 1,
          upsellFlowTransitions: 0,
          plannerChangedTurns: 1,
        },
        delta: {
          upsellGoals: 0,
          conflictTurns: 1,
          upsellFlowTransitions: 0,
          plannerChangedTurns: 1,
        },
      },
    } satisfies VenueSimReport;

    const violations = evaluateSimRegression(simReport);
    expect(violations.some((v) => v.includes("conflict turns increased"))).toBe(
      true
    );
  });

  it("stores manifest history on promote patch", () => {
    const patch = buildPromotedStoragePatch({
      existingRaw: { rollout: { mode: "shadow" } },
      manifest: baseManifest,
      historyEntry: {
        version: 1,
        manifest: baseManifest,
        promotedAt: "2026-05-29T12:00:00.000Z",
      },
    });

    const history = extractManifestHistory(patch);
    expect(history).toHaveLength(1);
    expect(history[0]?.version).toBe(1);
  });
});
