import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { foldNudgeOutcomes } from "@/lib/denis/cognition/offer/fold-nudge-outcomes";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";
import { readAcceptedNudgeOutcomes } from "@/lib/denis/learning/timeline-nudge-outcomes";
import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";

const BURGER = "11111111-1111-4111-8111-111111111111";
const REPO_ROOT = process.cwd();

const enforceOfferEnrichConfig = {
  ...CONCIERGE_PLATFORM_DEFAULTS,
  mentalModel: {
    ...CONCIERGE_PLATFORM_DEFAULTS.mentalModel,
    mode: "enforce" as const,
    confidenceFallbackThreshold: 0.4,
  },
  proactive: {
    ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
    offerEnrich: true,
  },
};

function minimalState(
  patch?: Partial<Pick<TableSessionState, "mental" | "offer">>
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
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config: enforceOfferEnrichConfig,
    ...patch,
  };
}

function mentalNeedsHelp() {
  return {
    ...emptyGuestMentalModel(),
    intent: "exploring" as const,
    predictedNeed: "needs_help_choosing" as const,
    receptiveness: "open" as const,
    confidence: 0.85,
    nudgeBudget: { remaining: 2, max: 2, cooldownUntil: null },
  };
}

function offerReadyBrowsePause() {
  const offer = emptyGuestOfferContext();
  offer.readiness = {
    ready: true,
    reason: "browse_pause",
    secondsSinceLastBrowseAction: 12,
  };
  offer.trace.timing = {
    kind: "browse_pause",
    idleSinceBrowseSec: 12,
    speakWindow: "open",
    ready: true,
    reason: "browse_pause",
  };
  offer.primary = {
    productId: BURGER,
    productName: "Beef Burger",
    categoryId: null,
    resolution: "top_dwell",
    score: 0.9,
    dedupeKey: `top_dwell:${BURGER}`,
    isKitchenBlocked: false,
  };
  offer.trace.strategy = "top_dwell_first";
  return offer;
}

describe("ADR-040 UPDS eval scenarios", () => {
  it("enforce_low_confidence_silence via planProactiveTurn (not bypass)", () => {
    const result = planProactiveTurn({
      state: minimalState({
        mental: {
          ...mentalNeedsHelp(),
          confidence: 0.2,
        },
        offer: offerReadyBrowsePause(),
      }),
      config: enforceOfferEnrichConfig,
      orders: [],
      sessionPhase: "browsing",
      payload: { browseMinutes: 5, guestMessageCount: 2 },
    });

    expect(result.skipped).toBe(true);
    expect(result.nudge).toBeNull();
    expect(result.mentalGate?.reason).toBe("gmm.confidence_insufficient");
    expect(result.mentalGate?.enforced).toBe(true);
  });

  it("gate_evaluation_chain_on_silence — policy block retains evaluationChain", () => {
    const offer = emptyGuestOfferContext();
    offer.readiness = {
      ready: false,
      reason: "not_ready_posture",
      secondsSinceLastBrowseAction: 5,
    };
    offer.trace.timing = {
      kind: "none",
      idleSinceBrowseSec: 5,
      speakWindow: "closed",
      ready: false,
      reason: "not_ready_posture",
    };

    const result = planProactiveTurn({
      state: minimalState({
        mental: mentalNeedsHelp(),
        offer,
      }),
      config: enforceOfferEnrichConfig,
      orders: [],
      sessionPhase: "browsing",
      payload: { browseMinutes: 5, guestMessageCount: 2 },
    });

    expect(result.skipped).toBe(true);
    expect(result.nudge).toBeNull();
    expect(result.mentalGate?.evaluationChain.length).toBeGreaterThan(0);
    expect(result.mentalGate?.evaluationChain.some((row) => !row.allow)).toBe(
      true
    );
    expect(result.mentalGate?.selectedKind).toBeNull();
  });

  it("timing_needs_help_browse_pause_speaks — enforce path with offer enrich", () => {
    const result = planProactiveTurn({
      state: minimalState({
        mental: mentalNeedsHelp(),
        offer: offerReadyBrowsePause(),
      }),
      config: enforceOfferEnrichConfig,
      orders: [],
      sessionPhase: "browsing",
      payload: { browseMinutes: 5, guestMessageCount: 2 },
    });

    expect(result.skipped).toBe(false);
    expect(result.nudge?.kind).toBe("browse_nudge");
    expect(result.mentalGate?.timingKind).toBe("browse_pause");
    expect(result.mentalGate?.allow).toBe(true);
    expect(result.message).toContain("Beef Burger");
  });

  it("staff_alert_excluded_from_nudge_outcomes", () => {
    const emitAt = "2026-06-07T12:20:00.000Z";
    const timeline: DenisTimelineRow[] = [
      {
        id: "staff-1",
        ai_session_id: "s1",
        seq: 1,
        event_type: "staff.proactive.alert",
        trace_id: "t-staff",
        context_hash: null,
        created_at: emitAt,
        payload: {
          type: "staff.proactive.alert",
          kind: "slow_kitchen",
          message: "Kitchen backlog",
        },
      },
      {
        id: "guest-1",
        ai_session_id: "s1",
        seq: 2,
        event_type: "proactive.emitted",
        trace_id: "t-guest",
        context_hash: null,
        created_at: emitAt,
        payload: {
          type: "proactive.emitted",
          kind: "browse_nudge",
          message: "Hoćete Beef Burger?",
          productId: BURGER,
          productName: "Beef Burger",
        },
      },
      {
        id: "resolved-staff",
        ai_session_id: "s1",
        seq: 3,
        event_type: "anticipation.resolved",
        trace_id: "t-resolved",
        context_hash: null,
        created_at: "2026-06-07T12:21:00.000Z",
        payload: {
          type: "anticipation.resolved",
          outcome: "accepted",
          productId: BURGER,
          nudgeKind: "slow_kitchen",
        },
      },
    ];

    const { outcomes, pending } = foldNudgeOutcomes(
      timeline,
      Date.parse("2026-06-07T12:26:00.000Z")
    );
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.nudgeKind).toBe("browse_nudge");
    expect(pending).toHaveLength(0);

    const accepts = readAcceptedNudgeOutcomes(timeline);
    expect(accepts).toHaveLength(1);
    expect(accepts[0]?.nudgeKind).toBe("slow_kitchen");
    expect(
      accepts.some((row) => row.nudgeKind === "staff.proactive.alert")
    ).toBe(false);
  });

  it("scheduler_tick_no_direct_emit — process-scheduler-tick routes via enqueueOrRunProactiveSessionTick (ADR-041)", () => {
    const source = readFileSync(
      join(REPO_ROOT, "src/lib/denis/runtime/process-scheduler-tick.ts"),
      "utf8"
    );
    expect(source).toContain("enqueueOrRunProactiveSessionTick");
    expect(source).not.toMatch(
      /appendDenisTimelineEvent\([\s\S]*?eventType:\s*["']proactive\.emitted["']/
    );
  });

  it("run-denis-sense uses emitProactiveNudge only (PDS-1)", () => {
    const source = readFileSync(
      join(REPO_ROOT, "src/lib/denis/runtime/run-denis-sense.ts"),
      "utf8"
    );
    expect(source).toContain("emitProactiveNudge");
    expect(source).not.toMatch(
      /appendDenisTimelineEvent\([\s\S]*?eventType:\s*["']proactive\.emitted["']/
    );
  });
});
