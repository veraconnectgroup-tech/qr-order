import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { foldSessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import { matchInterventionRules } from "@/lib/denis/cognition/intervention/evaluate-intervention-manifest";
import { DEFAULT_INTERVENTION_MANIFEST } from "@/lib/denis/cognition/intervention/intervention-manifest-defaults";
import { interventionManifestRequiresTimelineSim } from "@/lib/denis/cognition/intervention/intervention-manifest-promote-gate";
import { resolveInterventionManifest } from "@/lib/denis/cognition/intervention/resolve-intervention-manifest";
import { evaluateInterventionPipeline } from "@/lib/denis/cognition/intervention/run-intervention-pipeline";
import { resolveInterventionDeclineReason } from "@/lib/denis/cognition/intervention/run-intervention-pipeline";
import { shouldRecordInterventionSuperseded } from "@/lib/denis/cognition/intervention/run-intervention-pipeline";
import { extractPendingInterventionFromTimeline } from "@/lib/denis/cognition/intervention/extract-pending-intervention-from-timeline";
import { resolveInterventionLifecycleContext } from "@/lib/denis/cognition/intervention/resolve-intervention-lifecycle-context";
import { runInterventionManifestCompareSim } from "@/lib/denis/cognition/intervention/run-intervention-manifest-sim";
import { INTERVENTION_MANIFEST_SIM_SCENARIOS } from "@/lib/denis/eval/fixtures/intervention/manifest-sim-scenarios";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { resolveInterventionActorIngress } from "@/lib/denis/config/resolve-intervention-actor-ingress";
import {
  getInterventionEnforceViolations,
  isInterventionEnforceReady,
} from "@/lib/denis/config/resolve-intervention-enforce-ready";
import {
  resolveInterventionConfiguredMode,
  resolveInterventionMode,
} from "@/lib/denis/config/resolve-intervention-mode";
import { runInterventionManifestPromoteFixture } from "@/lib/denis/eval/run-intervention-manifest-promote-fixture";
import { buildScheduleDrafts } from "@/lib/denis/kernel/scheduler/build-schedules";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { browseRow } from "@/lib/denis/eval/fixtures/mental-model/scenarios";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const NOW = Date.parse("2026-06-07T20:00:00.000Z");
const BURGER = "11111111-1111-4111-8111-111111111111";

function isoSecondsAgo(seconds: number): string {
  return new Date(NOW - seconds * 1000).toISOString();
}

function minimalState(
  patch?: Partial<Pick<TableSessionState, "mental" | "offer" | "timeline" | "browse">>
): TableSessionState {
  return {
    table: { id: "t1", name: "T1", token: "tok" },
    session: {
      id: "s1",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: buildMergedCart({ ai: emptyCartState() }),
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "guest.seated",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(NOW),
    offer: emptyGuestOfferContext(NOW),
    config: CONCIERGE_PLATFORM_DEFAULTS,
    ...patch,
  };
}

describe("foldSessionTrajectory (ADR-041 IJS)", () => {
  it("trajectory_browse_stuck_needs_help", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      intent: "exploring" as const,
      predictedNeed: "needs_help_choosing" as const,
      receptiveness: "open" as const,
    };

    const offer = emptyGuestOfferContext(NOW);
    offer.trace.timing = {
      kind: "browse_pause",
      idleSinceBrowseSec: 12,
      speakWindow: "open",
      ready: true,
      reason: "browse_pause",
    };

    const trajectory = foldSessionTrajectory({
      timeline: [
        browseRow(1, {
          action: "view_product",
          productId: BURGER,
          productName: "Burger",
          categoryPath: ["food"],
          menuSection: "food",
          timestamp: isoSecondsAgo(12),
        }),
      ],
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: BURGER,
            productName: "Burger",
            categoryPath: [],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
          },
        ],
      },
      mental,
      orders: [],
      cartLineCount: 0,
      timing: offer.trace.timing,
      nowMs: NOW,
    });

    expect(trajectory.ordering).toBe("stuck");
    expect(trajectory.opportunity).toBeGreaterThan(0.35);
    expect(trajectory.evidence.some((row) => row.startsWith("browse.idle_"))).toBe(
      true
    );
  });
});

describe("evaluateInterventionPipeline (ADR-041 IJS-P0)", () => {
  it("manifest browse_stuck matches trajectory", () => {
    const mental = {
      ...emptyGuestMentalModel(NOW),
      intent: "exploring" as const,
      predictedNeed: "needs_help_choosing" as const,
      receptiveness: "open" as const,
    };

    const timing = {
      kind: "browse_pause" as const,
      idleSinceBrowseSec: 12,
      speakWindow: "open" as const,
      ready: true,
      reason: "browse_pause" as const,
    };

    const trajectory = foldSessionTrajectory({
      timeline: [
        browseRow(1, {
          action: "view_product",
          productId: BURGER,
          productName: "Burger",
          categoryPath: ["food"],
          menuSection: "food",
          timestamp: isoSecondsAgo(12),
        }),
      ],
      browse: {
        ...emptyBrowseProfile(),
        viewedProducts: [
          {
            productId: BURGER,
            productName: "Burger",
            categoryPath: [],
            viewCount: 1,
            totalDwellMs: 4000,
            addedToCart: false,
            removedFromCart: false,
          },
        ],
      },
      mental,
      orders: [],
      cartLineCount: 0,
      timing,
      nowMs: NOW,
    });

    const matched = matchInterventionRules({
      manifest: DEFAULT_INTERVENTION_MANIFEST,
      trajectory,
      mental,
      offerTiming: timing,
    });

    expect(matched.some((row) => row.ruleId === "browse_stuck")).toBe(true);
  });

  it("enforce would block when IJS silence but UPDS would speak", () => {
    const evaluation = evaluateInterventionPipeline({
      state: minimalState({
        mental: {
          ...emptyGuestMentalModel(NOW),
          intent: "arrived",
          predictedNeed: "none",
        },
      }),
      proactiveResult: {
        beliefs: {} as never,
        turnPlan: { kind: "template_tell", requiresLlm: false } as never,
        nudge: { kind: "browse_nudge", message: "Help?" },
        message: "Help?",
        skipped: false,
        skipReason: null,
        candidateKind: "browse_nudge",
      },
      enforceBlock: true,
    });

    expect(evaluation.updsWouldSpeak).toBe(true);
    expect(evaluation.ijsDecision).toBe("silence");
    expect(evaluation.shouldBlockSpeak).toBe(true);
  });
});

describe("resolveInterventionDeclineReason (ADR-041 IJS-P2)", () => {
  it("returns upds_silence when UPDS skips", () => {
    const evaluation = evaluateInterventionPipeline({
      state: minimalState(),
      proactiveResult: {
        beliefs: {} as never,
        turnPlan: null,
        nudge: null,
        message: null,
        skipped: true,
        skipReason: "cooldown",
        candidateKind: null,
      },
    });

    expect(resolveInterventionDeclineReason(evaluation)).toBe("cooldown");
  });

  it("returns ijs_enforce_block when enforce would block speak", () => {
    const evaluation = evaluateInterventionPipeline({
      state: minimalState({
        mental: {
          ...emptyGuestMentalModel(NOW),
          intent: "arrived",
          predictedNeed: "none",
        },
      }),
      proactiveResult: {
        beliefs: {} as never,
        turnPlan: { kind: "template_tell", requiresLlm: false } as never,
        nudge: { kind: "browse_nudge", message: "Help?" },
        message: "Help?",
        skipped: false,
        skipReason: null,
        candidateKind: "browse_nudge",
      },
      enforceBlock: true,
    });

    expect(resolveInterventionDeclineReason(evaluation)).toBe("ijs_enforce_block");
  });
});

describe("resolveInterventionActorIngress (ADR-041 IJS-P1)", () => {
  it("requires IJS active and table session actor rollout", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      intervention: { enabled: true, mode: "shadow" as const },
      rollout: {
        ...CONCIERGE_PLATFORM_DEFAULTS.rollout,
        tableSessionActorEnabled: true,
      },
    };

    expect(resolveInterventionActorIngress(config, true)).toBe(true);
    expect(resolveInterventionActorIngress(config, false)).toBe(false);
    expect(
      resolveInterventionActorIngress(
        {
          ...config,
          intervention: { enabled: false, mode: "off" as const },
        },
        true
      )
    ).toBe(false);
  });
});

describe("resolveInterventionEnforceReady (ADR-041 IJS-P3)", () => {
  it("downgrades enforce when UPDS R1 pairing missing", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      intervention: { enabled: true, mode: "enforce" as const },
    };

    expect(resolveInterventionConfiguredMode(config)).toBe("enforce");
    expect(isInterventionEnforceReady(config)).toBe(false);
    expect(resolveInterventionMode(config)).toBe("shadow");
    expect(getInterventionEnforceViolations(config).length).toBeGreaterThan(0);
  });

  it("keeps enforce when GMM enforce + offerEnrich are on", () => {
    const config = {
      ...CONCIERGE_PLATFORM_DEFAULTS,
      proactive: {
        ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
        offerEnrich: true,
      },
      mentalModel: {
        ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
        mode: "enforce" as const,
      },
      intervention: { enabled: true, mode: "enforce" as const },
    };

    expect(isInterventionEnforceReady(config)).toBe(true);
    expect(resolveInterventionMode(config)).toBe("enforce");
  });
});

describe("buildScheduleDrafts IJS wake (ADR-041 IJS-P3)", () => {
  it("uses INTERVENTION_WAKE instead of DESSERT_UPSELL when IJS active", () => {
    const now = new Date("2026-06-07T19:45:00.000Z");
    const drafts = buildScheduleDrafts({
      orders: [
        {
          id: "o1",
          status: "delivered",
          created_at: "2026-06-07T19:00:00.000Z",
          delivered_at: "2026-06-07T19:30:00.000Z",
          order_items: [
            { product_name: "Burger", quantity: 1, menu_section: "food" },
          ],
        },
      ],
      config: CONCIERGE_PLATFORM_DEFAULTS,
      interventionJournalActive: true,
      now,
    });

    expect(drafts.some((row) => row.intentType === "INTERVENTION_WAKE")).toBe(
      true
    );
    expect(drafts.some((row) => row.intentType === "DESSERT_UPSELL")).toBe(
      false
    );
  });
});

describe("intervention manifest promote gate (ADR-041 IJS-P3)", () => {
  it("requires timeline sim when rules change", () => {
    const proposed = {
      ...DEFAULT_INTERVENTION_MANIFEST,
      rules: DEFAULT_INTERVENTION_MANIFEST.rules.slice(0, 1),
    };

    expect(
      interventionManifestRequiresTimelineSim(DEFAULT_INTERVENTION_MANIFEST, proposed)
    ).toBe(true);
  });

  it("resolveInterventionManifest uses platform default", () => {
    expect(resolveInterventionManifest(CONCIERGE_PLATFORM_DEFAULTS).version).toBe(
      "ijs-v1"
    );
  });

  it("promote fixture passes", () => {
    expect(runInterventionManifestPromoteFixture().ok).toBe(true);
  });

  it("manifest sim detects rule regression", () => {
    const stripped = {
      ...DEFAULT_INTERVENTION_MANIFEST,
      version: "ijs-v1-stripped",
      rules: [],
    };
    const report = runInterventionManifestCompareSim({
      baseline: DEFAULT_INTERVENTION_MANIFEST,
      proposed: stripped,
      scenarios: INTERVENTION_MANIFEST_SIM_SCENARIOS,
    });
    expect(report.ok).toBe(true);
  });
});

describe("intervention lifecycle (ADR-041 IJS-P4/P5)", () => {
  it("superseded when new tick replaces defer", () => {
    expect(
      shouldRecordInterventionSuperseded({
        previousDecision: "defer",
        nextDecision: "speak",
      })
    ).toBe(true);
    expect(
      shouldRecordInterventionSuperseded({
        previousDecision: "defer",
        nextDecision: "defer",
      })
    ).toBe(false);
  });

  it("extracts pending defer from mental_model.gate timeline", () => {
    const traceId = "trace-defer-1";
    const timeline = [
      {
        id: "1",
        ai_session_id: "ai1",
        seq: 1,
        event_type: "mental_model.gate",
        trace_id: traceId,
        context_hash: null,
        created_at: "2026-06-07T20:00:00.000Z",
        payload: {
          type: "mental_model.gate",
          mode: "shadow",
          candidateKind: "browse_nudge",
          allow: true,
          enforced: false,
          reason: null,
          wouldBlock: false,
          mentalHash: "abc",
          ijs: {
            manifestVersion: "ijs-v1",
            decision: "defer",
            ijsDecision: "speak",
            ruleId: "browse_stuck",
            shouldBlockSpeak: false,
            enforced: false,
          },
        },
      },
    ] as DenisTimelineRow[];

    const pending = extractPendingInterventionFromTimeline(timeline);
    expect(pending?.interventionId).toBe(`${traceId}:ijs`);
    expect(pending?.decision).toBe("defer");
  });

  it("resolveInterventionLifecycleContext marks defer expired after debounce", () => {
    const traceId = "trace-defer-2";
    const timeline = [
      {
        id: "1",
        ai_session_id: "ai1",
        seq: 1,
        event_type: "mental_model.gate",
        trace_id: traceId,
        context_hash: null,
        created_at: "2026-06-07T20:00:00.000Z",
        payload: {
          type: "mental_model.gate",
          mode: "shadow",
          candidateKind: "browse_nudge",
          allow: true,
          enforced: false,
          reason: null,
          wouldBlock: false,
          mentalHash: "abc",
          ijs: {
            manifestVersion: "ijs-v1",
            decision: "defer",
            ijsDecision: "speak",
            ruleId: "browse_stuck",
            shouldBlockSpeak: false,
            enforced: false,
          },
        },
      },
    ] as DenisTimelineRow[];

    const fresh = resolveInterventionLifecycleContext({
      timeline,
      manifest: DEFAULT_INTERVENTION_MANIFEST,
      nowMs: Date.parse("2026-06-07T20:00:10.000Z"),
    });
    expect(fresh.deferExpired).toBe(false);

    const expired = resolveInterventionLifecycleContext({
      timeline,
      manifest: DEFAULT_INTERVENTION_MANIFEST,
      nowMs: Date.parse("2026-06-07T20:00:20.000Z"),
    });
    expect(expired.deferExpired).toBe(true);
    expect(expired.previousInterventionId).toBe(`${traceId}:ijs`);
  });
});
