import { compileBeliefs } from "@/lib/denis/cognition/beliefs/compile-beliefs";
import {
  buildInterpretationTask,
} from "@/lib/denis/cognition/tde/build-interpretation-task";
import { decideTurnPlan } from "@/lib/denis/cognition/tde/decide-turn-plan";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { planTurnWithReflex } from "@/lib/denis/kernel/reflex-plan";
import {
  INTERPRETATION_TASK_SCENARIOS,
  type InterpretationTaskScenario,
} from "@/lib/denis/eval/fixtures/interpretation-task/scenarios";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { TableSessionState } from "@/lib/denis/loop/types";
import type { WaiterParitySetup } from "@/lib/denis/eval/waiter-parity-types";

export type InterpretationTaskScenarioResult = {
  id: string;
  passed: boolean;
  errors: string[];
};

export type InterpretationTaskReport = {
  ok: boolean;
  scenarioCount: number;
  results: InterpretationTaskScenarioResult[];
};

function buildState(setup: WaiterParitySetup): TableSessionState {
  const items = setup.aiCartItems ?? [];

  return {
    table: { id: "table-arch7", name: "Table 8", token: "demo-table-8" },
    session: {
      id: "sess-arch7",
      status: "active",
      accessState: null,
      billSettled: false,
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
      pendingSlot: setup.pendingSlot ?? null,
      model: emptyConversationModel(),
      obligation: null,
    },
    config: CONCIERGE_PLATFORM_DEFAULTS,
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(),
    offer: emptyGuestOfferContext(),
  };
}

function runScenario(
  scenario: InterpretationTaskScenario
): InterpretationTaskScenarioResult {
  const errors: string[] = [];
  const setup = scenario.setup ?? {};
  const state = buildState(setup);

  const beliefs = compileBeliefs({
    state,
    guestMessage: scenario.message,
    sessionLanguage: "sr",
  });

  const reflex = planTurnWithReflex({
    config: state.config,
    message: scenario.message,
    flowNodeId: state.conversation.flowNodeId,
    cartState: {
      ...emptyCartState(),
      draft: {
        cartRevision: 1,
        items: setup.aiCartItems ?? [],
      },
    },
    skipUpsell: state.venue.opsEffects.skipUpsell,
  });

  if (scenario.topGoalOverride) {
    reflex.plan = {
      ...reflex.plan,
      topGoal: scenario.topGoalOverride,
    };
  }

  const plan = decideTurnPlan({
    beliefs,
    reflex,
    message: scenario.message,
  });

  const task = buildInterpretationTask(reflex.plan.topGoal, beliefs);

  if (plan.kind !== scenario.expect.planKind) {
    errors.push(
      `planKind: expected ${scenario.expect.planKind}, got ${plan.kind}`
    );
  }
  if (plan.reason !== scenario.expect.reason) {
    errors.push(`reason: expected ${scenario.expect.reason}, got ${plan.reason}`);
  }
  for (const forbidden of scenario.expect.forbidReasons ?? []) {
    if (plan.reason.includes(forbidden)) {
      errors.push(`reason must not include regex path "${forbidden}"`);
    }
  }
  if (scenario.expect.schema) {
    if (!task) {
      errors.push("interpretationTask: expected task, got null");
    } else if (task.schema !== scenario.expect.schema) {
      errors.push(
        `schema: expected ${scenario.expect.schema}, got ${task.schema}`
      );
    }
  }

  return {
    id: scenario.id,
    passed: errors.length === 0,
    errors,
  };
}

export function runInterpretationTaskSuite(): InterpretationTaskReport {
  const results = INTERPRETATION_TASK_SCENARIOS.map(runScenario);
  return {
    ok: results.every((row) => row.passed),
    scenarioCount: results.length,
    results,
  };
}
