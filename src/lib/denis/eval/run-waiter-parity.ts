import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  compileBeliefs,
  CORE_BELIEF_KEYS,
  getBeliefValue,
} from "@/lib/denis/cognition/beliefs";
import { normalizePendingSlotReply } from "@/lib/denis/cognition/act/fuzzy-slot-reply";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  WAITER_PARITY_MIN_PASS_RATE,
  WAITER_PARITY_MIN_SCENARIOS,
  WAITER_PARITY_SCENARIOS,
} from "@/lib/denis/eval/fixtures/waiter-parity/scenarios";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { deriveFoldSessionPhase } from "@/lib/denis/loop/derive-fold-phase";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type {
  WaiterParityReport,
  WaiterParityScenario,
  WaiterParityScenarioResult,
  WaiterParitySetup,
  WaiterParityTurn,
  WaiterParityTurnExpect,
  WaiterParityTurnResult,
} from "@/lib/denis/eval/waiter-parity-types";
import type { DenisCartLine } from "@/lib/denis/kernel/cart-projection";
import type { SessionPhase } from "@/lib/scene/types";

type MutableSession = {
  setup: WaiterParitySetup;
  sessionPhase?: SessionPhase;
};

function mergeSetup(
  base: WaiterParitySetup,
  patch?: WaiterParitySetup
): WaiterParitySetup {
  if (!patch) return base;
  return {
    flowNodeId: patch.flowNodeId ?? base.flowNodeId,
    aiCartItems: patch.aiCartItems ?? base.aiCartItems,
    lastAssistantMessage:
      patch.lastAssistantMessage !== undefined
        ? patch.lastAssistantMessage
        : base.lastAssistantMessage,
    orders: patch.orders ?? base.orders,
    billSettled: patch.billSettled ?? base.billSettled,
    operatingMode: patch.operatingMode ?? base.operatingMode,
  };
}

function buildState(
  setup: WaiterParitySetup,
  sessionPhase?: SessionPhase
): TableSessionState {
  const items = setup.aiCartItems ?? [];
  const config = CONCIERGE_PLATFORM_DEFAULTS;

  const state: TableSessionState = {
    table: { id: "table-8", name: "Table 8", token: "demo-table-8" },
    session: {
      id: "sess-eval",
      status: "active",
      accessState: null,
      billSettled: setup.billSettled ?? false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders: setup.orders ?? [],
      cart: buildMergedCart({
        ai: {
          ...emptyCartState(),
          draft: {
            cartRevision: 1,
            items,
          },
        },
      }),
    },
    venue: {
      ops: {
        operatingMode: setup.operatingMode ?? "normal",
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
      flowNodeId: setup.flowNodeId ?? "welcome",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: setup.lastAssistantMessage ?? null,
    },
    timeline: [],
    config,
  };

  if (!sessionPhase) {
    void deriveFoldSessionPhase({
      sessionStatus: state.session.status,
      accessState: state.session.accessState,
      orders: state.commerce.orders,
      hasCartActivity: items.length > 0,
      billSettled: state.session.billSettled,
    });
  }

  return state;
}

function applyAfterMutation(
  items: DenisCartLine[],
  after?: WaiterParityTurn["after"]
): DenisCartLine[] {
  if (!after?.applyServeSize) return items;

  const next = items.map((line) => ({ ...line }));
  const target = next.find((line) => !line.serveSize?.trim());
  if (target) {
    target.serveSize = after.applyServeSize;
  }
  return next;
}

function assertTurnExpect(
  expect: WaiterParityTurnExpect,
  actual: WaiterParityTurnResult["actual"],
  situationPack: string,
  errors: string[]
) {
  if (expect.planKind && actual.planKind !== expect.planKind) {
    errors.push(`planKind: expected ${expect.planKind}, got ${actual.planKind}`);
  }

  if (expect.forbidPlanKinds) {
    for (const forbidden of expect.forbidPlanKinds) {
      if (actual.planKind === forbidden) {
        errors.push(`planKind must not be ${forbidden}`);
      }
    }
  }

  if (
    expect.requiresLlm !== undefined &&
    actual.requiresLlm !== expect.requiresLlm
  ) {
    errors.push(
      `requiresLlm: expected ${expect.requiresLlm}, got ${actual.requiresLlm}`
    );
  }

  if (expect.reason && actual.reason !== expect.reason) {
    errors.push(`reason: expected ${expect.reason}, got ${actual.reason}`);
  }

  if (
    expect.conversationMode &&
    actual.conversationMode !== expect.conversationMode
  ) {
    errors.push(
      `conversation.mode: expected ${expect.conversationMode}, got ${actual.conversationMode ?? "null"}`
    );
  }

  if (expect.conversationAwaiting !== undefined) {
    const awaiting = actual.conversationAwaiting ?? null;
    if (awaiting !== expect.conversationAwaiting) {
      errors.push(
        `conversation.awaiting: expected ${String(expect.conversationAwaiting)}, got ${String(awaiting)}`
      );
    }
  }

  if (expect.commercePendingSlot !== undefined) {
    const slot = actual.commercePendingSlot ?? null;
    if (slot !== expect.commercePendingSlot) {
      errors.push(
        `commerce.pending_slot: expected ${String(expect.commercePendingSlot)}, got ${String(slot)}`
      );
    }
  }

  if (expect.usedT0 !== undefined && actual.usedT0 !== expect.usedT0) {
    errors.push(`usedT0: expected ${expect.usedT0}, got ${actual.usedT0}`);
  }

  if (expect.fuzzyNormalized !== undefined) {
    if (actual.fuzzyNormalized !== expect.fuzzyNormalized) {
      errors.push(
        `fuzzyNormalized: expected ${expect.fuzzyNormalized}, got ${actual.fuzzyNormalized ?? "null"}`
      );
    }
  }

  if (expect.situationIncludes) {
    for (const fragment of expect.situationIncludes) {
      if (!situationPack.includes(fragment)) {
        errors.push(`situation pack missing: ${fragment}`);
      }
    }
  }
}

function runWaiterParityTurn(
  turn: WaiterParityTurn,
  turnIndex: number,
  session: MutableSession,
  scenario: WaiterParityScenario
): WaiterParityTurnResult {
  const errors: string[] = [];

  session.setup = mergeSetup(session.setup, turn.setup);
  const state = buildState(session.setup, session.sessionPhase ?? scenario.sessionPhase);
  const beliefs = compileBeliefs({
    state,
    guestMessage: turn.message,
    sessionLanguage: scenario.sessionLanguage ?? "sr",
  });

  const reflex = planTurnWithReflex({
    config: state.config,
    message: turn.message,
    flowNodeId: state.conversation.flowNodeId,
    cartState: {
      ...emptyCartState(),
      draft: {
        cartRevision: 1,
        items: session.setup.aiCartItems ?? [],
      },
    },
    skipUpsell: state.venue.opsEffects.skipUpsell,
  });

  const plan = decideTurnPlan({
    beliefs,
    reflex,
    message: turn.message,
  });

  const pendingSlot = getBeliefValue<string>(
    beliefs,
    CORE_BELIEF_KEYS.commercePendingSlot
  );
  const fuzzyNormalized = pendingSlot
    ? normalizePendingSlotReply(
        pendingSlot,
        turn.message,
        scenario.serveSizeOptions ?? []
      )
    : undefined;

  const situationPack = plan.requiresLlm
    ? buildSituationPack({
        state,
        beliefs,
        sessionPhase: scenario.sessionPhase ?? null,
        flowNodeId: state.conversation.flowNodeId,
        venueOps: state.venue.ops,
        opsEffects: state.venue.opsEffects,
        transcript: state.conversation.lastAssistantMessage
          ? [
              {
                role: "assistant" as const,
                content: state.conversation.lastAssistantMessage,
              },
              { role: "user" as const, content: turn.message },
            ]
          : [{ role: "user" as const, content: turn.message }],
      })
    : "";

  const actual: WaiterParityTurnResult["actual"] = {
    planKind: plan.kind,
    requiresLlm: plan.requiresLlm,
    reason: plan.reason,
    conversationMode: getBeliefValue(beliefs, CORE_BELIEF_KEYS.conversationMode),
    conversationAwaiting: getBeliefValue(
      beliefs,
      CORE_BELIEF_KEYS.conversationAwaiting
    ),
    commercePendingSlot: getBeliefValue(
      beliefs,
      CORE_BELIEF_KEYS.commercePendingSlot
    ),
    usedT0: reflex.usedT0,
    fuzzyNormalized,
  };

  assertTurnExpect(turn.expect, actual, situationPack, errors);

  if (turn.after) {
    session.setup.aiCartItems = applyAfterMutation(
      session.setup.aiCartItems ?? [],
      turn.after
    );
  }

  return {
    turnIndex,
    message: turn.message,
    passed: errors.length === 0,
    errors,
    actual,
  };
}

export function runWaiterParityScenario(
  scenario: WaiterParityScenario
): WaiterParityScenarioResult {
  const session: MutableSession = {
    setup: mergeSetup(
      {
        flowNodeId: "welcome",
        aiCartItems: [],
        lastAssistantMessage: null,
      },
      scenario.baseSetup
    ),
    sessionPhase: scenario.sessionPhase,
  };

  const turnResults = scenario.turns.map((turn, index) =>
    runWaiterParityTurn(turn, index, session, scenario)
  );

  const errors = turnResults.flatMap((turn) =>
    turn.errors.map((error) => `turn ${turn.turnIndex + 1}: ${error}`)
  );

  return {
    scenarioId: scenario.id,
    passed: errors.length === 0,
    errors,
    turns: turnResults,
  };
}

/** ADR-031 C3 — waiter-parity journey eval (kernel cognition, no LLM). */
export function runWaiterParitySuite(): WaiterParityReport {
  const results = WAITER_PARITY_SCENARIOS.map(runWaiterParityScenario);
  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;
  const passRate = results.length ? passed / results.length : 0;

  return {
    ok:
      failed === 0 &&
      results.length >= WAITER_PARITY_MIN_SCENARIOS &&
      passRate >= WAITER_PARITY_MIN_PASS_RATE,
    scenarioCount: results.length,
    passed,
    failed,
    passRate,
    minPassRate: WAITER_PARITY_MIN_PASS_RATE,
    results,
  };
}

export {
  WAITER_PARITY_MIN_PASS_RATE,
  WAITER_PARITY_MIN_SCENARIOS,
  WAITER_PARITY_SCENARIOS,
};

export type { WaiterParityReport } from "@/lib/denis/eval/waiter-parity-types";
