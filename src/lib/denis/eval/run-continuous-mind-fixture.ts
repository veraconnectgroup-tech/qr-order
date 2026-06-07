import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import {
  compileBeliefs,
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/beliefs";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import {
  detectWaiterObligationTell,
  mergeTableSessionObligation,
  withMergedObligation,
} from "@/lib/denis/cognition/waiter";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import {
  CONTINUOUS_MIND_SCENARIOS,
  type ContinuousMindScenario,
} from "@/lib/denis/eval/fixtures/continuous-mind/scenarios";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { foldTranscriptFromTimeline } from "@/lib/denis/loop/fold-transcript";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { WaiterObligation } from "@/lib/denis/cognition/waiter/waiter-obligation-types";

export type ContinuousMindScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type ContinuousMindReport = {
  ok: boolean;
  scenarioCount: number;
  results: ContinuousMindScenarioResult[];
};

function buildStateFromScenario(
  scenario: ContinuousMindScenario
): TableSessionState {
  const transcript = foldTranscriptFromTimeline(scenario.timeline);

  return {
    table: { id: "table-cm-1", name: "Demo Table 1", token: "demo-table-1" },
    session: {
      id: "sess-cm-fixture",
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
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

function obligationSnapshot(obligation: WaiterObligation) {
  return {
    gapCount: obligation.gaps.length,
    primaryGap: obligation.primaryGap,
    canConfirm: obligation.canConfirm,
    nextAction: obligation.nextAction,
  };
}

function assertObligationParity(
  errors: string[],
  label: string,
  expected: WaiterObligation,
  actual: WaiterObligation
): void {
  const exp = obligationSnapshot(expected);
  const got = obligationSnapshot(actual);

  if (JSON.stringify(exp) !== JSON.stringify(got)) {
    errors.push(
      `${label}: expected ${JSON.stringify(exp)}, got ${JSON.stringify(got)}`
    );
  }
}

function runContinuousMindScenario(
  scenario: ContinuousMindScenario
): ContinuousMindScenarioResult {
  const errors: string[] = [];
  const state = buildStateFromScenario(scenario);
  const expect = scenario.expect;

  const foldObligation = mergeTableSessionObligation({
    state,
    source: "fold",
  });
  const watcherObligation = mergeTableSessionObligation({
    state,
    source: "watcher",
  });
  const turnObligation = mergeTableSessionObligation({
    state,
    source: "turn",
    guestMessage: scenario.guestMessage,
  });
  const worldObligation = mergeTableSessionObligation({
    state,
    source: "world",
  });

  if (expect.gapCount !== foldObligation.gaps.length) {
    errors.push(
      `gapCount: expected ${expect.gapCount}, got ${foldObligation.gaps.length}`
    );
  }

  if (
    expect.primaryGap !== undefined &&
    foldObligation.primaryGap !== expect.primaryGap
  ) {
    errors.push(
      `primaryGap: expected ${expect.primaryGap}, got ${foldObligation.primaryGap}`
    );
  }

  if (
    expect.canConfirm !== undefined &&
    foldObligation.canConfirm !== expect.canConfirm
  ) {
    errors.push(
      `canConfirm: expected ${expect.canConfirm}, got ${foldObligation.canConfirm}`
    );
  }

  if (expect.foldMatchesWatcher !== false) {
    assertObligationParity(
      errors,
      "fold vs watcher",
      foldObligation,
      watcherObligation
    );
  }

  if (expect.foldMatchesTurn !== false) {
    assertObligationParity(errors, "fold vs turn", foldObligation, turnObligation);
  }

  if (expect.foldMatchesWorld !== false) {
    assertObligationParity(errors, "fold vs world", foldObligation, worldObligation);
  }

  const mergedState = withMergedObligation(state, foldObligation);
  const beliefs = compileBeliefs({
    state: mergedState,
    guestMessage: scenario.guestMessage ?? "",
    sessionLanguage: "sr",
  });

  const beliefGapCount = getBeliefValue<number>(
    beliefs,
    CORE_BELIEF_KEYS.waiterGapCount
  );
  if (beliefGapCount !== foldObligation.gaps.length) {
    errors.push(
      `beliefs waiter.gap_count: expected ${foldObligation.gaps.length}, got ${beliefGapCount}`
    );
  }

  if (foldObligation.gaps.length > 0) {
    const tell = detectWaiterObligationTell(mergedState, "sr");
    if (!tell?.message?.trim()) {
      errors.push("expected autonomous waiter_gap tell from merged state");
    }

    const proactive = planProactiveTurn({
      state: mergedState,
      config: mergedState.config,
      orders: [],
      sessionPhase: "ordering",
      payload: {
        sessionAgeSeconds: 30,
        guestMessageCount: 1,
        cartItemCount: scenario.cartLines.length,
        language: "sr",
      },
    });

    if (proactive.candidateKind !== "waiter_gap") {
      errors.push(
        `watcher proactive: expected waiter_gap, got ${proactive.candidateKind}`
      );
    }
  }

  return {
    id: scenario.id,
    passed: errors.length === 0,
    errors,
  };
}

/** ARCH-6 — continuous mind obligation merge across fold / watcher / turn / world. */
export function runContinuousMindSuite(): ContinuousMindReport {
  const results = CONTINUOUS_MIND_SCENARIOS.map(runContinuousMindScenario);

  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}
