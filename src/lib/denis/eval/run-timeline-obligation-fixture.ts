import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import {
  detectWaiterObligationTell,
  mergeTableSessionObligation,
  withMergedObligation,
} from "@/lib/denis/cognition/waiter";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  IOTA_TIMELINE_OBLIGATION_SCENARIOS,
  type TimelineObligationScenario,
} from "@/lib/denis/eval/fixtures/timeline/iota-obligation-scenarios";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import { extractTimelineReplayTurns } from "@/lib/denis/eval/extract-timeline-turns";
import type { TableSessionState } from "@/lib/denis/loop/types";

export type TimelineObligationScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type TimelineObligationReport = {
  ok: boolean;
  scenarioCount: number;
  results: TimelineObligationScenarioResult[];
};

function buildStateFromScenario(
  scenario: TimelineObligationScenario
): TableSessionState {
  const transcript = foldTranscriptFromTimeline(scenario.timeline);

  return {
    table: { id: "table-skyline-1", name: "Demo Table 1", token: "demo-table-1" },
    session: {
      id: "sess-iota-fixture",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: [],
      cart: buildMergedCart({
        ai: {
          ...emptyCartState(),
          draft: {
            cartRevision: 1,
            items: scenario.cartLines,
          },
        },
      }),
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
      flowNodeId: scenario.flowNodeId,
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: {
        ...emptyConversationModel(),
        transcript,
        thread: {
          guestTurns: transcript.filter((e) => e.role === "guest").length,
          denisTurns: transcript.filter((e) => e.role === "denis").length,
          lastGuestText:
            [...transcript].reverse().find((e) => e.role === "guest")?.text ??
            null,
          lastDenisText:
            [...transcript].reverse().find((e) => e.role === "denis")?.text ??
            null,
          denisAskedQuestion: false,
        },
      },
      obligation: null,
    },
    timeline: scenario.timeline,
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

function runTimelineObligationScenario(
  scenario: TimelineObligationScenario
): TimelineObligationScenarioResult {
  const errors: string[] = [];
  const state = buildStateFromScenario(scenario);
  const transcript = state.conversation.model.transcript;
  const atRecap = scenario.flowNodeId === "recap";

  const obligation = mergeTableSessionObligation({
    state,
    source: "fold",
    cartLines: scenario.cartLines,
    guestMessage: scenario.guestMessage,
    language: "sr",
    atRecap,
  });

  const mergedState = withMergedObligation(state, obligation);
  state.conversation.obligation = mergedState.conversation.obligation;

  const expect = scenario.expect;

  if (expect.gapCount !== undefined && obligation.gaps.length !== expect.gapCount) {
    errors.push(
      `gapCount: expected ${expect.gapCount}, got ${obligation.gaps.length}`
    );
  }

  if (
    expect.primaryGap !== undefined &&
    obligation.primaryGap !== expect.primaryGap
  ) {
    errors.push(
      `primaryGap: expected ${expect.primaryGap}, got ${obligation.primaryGap}`
    );
  }

  if (
    expect.canConfirm !== undefined &&
    obligation.canConfirm !== expect.canConfirm
  ) {
    errors.push(
      `canConfirm: expected ${expect.canConfirm}, got ${obligation.canConfirm}`
    );
  }

  if (expect.autonomousTell) {
    const tell = detectWaiterObligationTell(mergedState, "sr");
    if (!tell?.message?.trim()) {
      errors.push("expected autonomous waiter_gap tell");
    }
  }

  if (scenario.guestMessage && (expect.planKind || expect.planReason)) {
    const beliefs = compileBeliefs({
      state: mergedState,
      guestMessage: scenario.guestMessage,
      sessionLanguage: "sr",
    });

    const reflex = planTurnWithReflex({
      config: state.config,
      message: scenario.guestMessage,
      flowNodeId: scenario.flowNodeId,
      cartState: state.commerce.cart.ai,
      structuredIntent: undefined,
      handoffPaymentMethod: null,
    });

    const plan = decideTurnPlan({
      message: scenario.guestMessage,
      beliefs,
      reflex,
      committedFacts: [],
    });

    if (expect.planKind && plan.kind !== expect.planKind) {
      errors.push(`planKind: expected ${expect.planKind}, got ${plan.kind}`);
    }
    if (expect.planReason && plan.reason !== expect.planReason) {
      errors.push(`planReason: expected ${expect.planReason}, got ${plan.reason}`);
    }
  }

  const replayTurns = extractTimelineReplayTurns(scenario.timeline);
  if (!replayTurns.length) {
    errors.push("timeline must yield at least one replay turn");
  }

  const orderLine = replayTurns.find((t) =>
    /pivo|burger/i.test(t.guestText)
  );
  if (!orderLine && scenario.id !== "tl_iota_complete_cart_confirm") {
    errors.push("timeline replay missing order placement turn");
  }

  return {
    id: scenario.id,
    passed: errors.length === 0,
    errors,
  };
}

/** P1-T7 — replay iota-style timelines through obligation + TDE (no DB, no LLM). */
export function runTimelineObligationSuite(): TimelineObligationReport {
  const results = IOTA_TIMELINE_OBLIGATION_SCENARIOS.map(
    runTimelineObligationScenario
  );

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}
