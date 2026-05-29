import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import {
  ANTICIPATION_EVAL_NOW,
  ANTICIPATION_MIN_PASS_RATE,
  ANTICIPATION_MIN_SCENARIOS,
  ANTICIPATION_SCENARIOS,
} from "@/lib/denis/eval/fixtures/anticipation/scenarios";
import type {
  AnticipationReport,
  AnticipationScenario,
  AnticipationScenarioResult,
  AnticipationSetup,
} from "@/lib/denis/eval/anticipation-types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import type { OrderFact, TableSessionState } from "@/lib/denis/loop/types";
import type { AiGuestOrder } from "@/lib/ai/order-context";

function buildConfig(setup: AnticipationSetup): ConciergeConfig {
  return {
    ...CONCIERGE_PLATFORM_DEFAULTS,
    proactive: {
      ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
      enabled: setup.proactiveEnabled ?? true,
      pairing: setup.pairingEnabled ?? true,
      dessert: setup.dessertEnabled ?? true,
      slowKitchen: setup.slowKitchenEnabled ?? true,
    },
  };
}

function buildState(setup: AnticipationSetup): TableSessionState {
  const items = setup.aiCartItems ?? [];
  const config = buildConfig(setup);

  return {
    table: { id: "table-4", name: "Table 4", token: "demo-table-4" },
    session: {
      id: "sess-anticipation",
      status: setup.sessionPhase === "closed" ? "closed" : "active",
      accessState: setup.sessionPhase === "closed" ? "closed" : null,
      billSettled: setup.sessionPhase === "settling",
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
        skipUpsell: setup.skipUpsell ?? false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "guest.seated",
      foodUpsellAsked: false,
      dismissedNudges: setup.dismissedNudges ?? [],
      lastAssistantMessage: null,
      pendingSlot: setup.pendingSlot ?? null,
    },
    timeline: [],
    config,
  };
}

function orderFactsToGuestOrders(orders: OrderFact[]): AiGuestOrder[] {
  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.createdAt,
    delivered_at: order.status === "delivered" ? order.createdAt : null,
    order_items: order.items.map((item) => ({
      product_id: null,
      product_name: item.productName,
      unit_price: 0,
      quantity: item.quantity,
      menu_section: inferMenuSection(item.productName),
    })),
  }));
}

function inferMenuSection(name: string): "food" | "drinks" | "desserts" {
  const lower = name.toLowerCase();
  if (/(tiramisu|dessert|cake|ice cream|kolač)/i.test(lower)) return "desserts";
  if (/(cola|pils|beer|pivo|wine|water|espresso|latte|drink)/i.test(lower)) {
    return "drinks";
  }
  return "food";
}

function runAnticipationScenario(
  scenario: AnticipationScenario
): AnticipationScenarioResult {
  const errors: string[] = [];
  const state = buildState(scenario.setup);
  const orders = orderFactsToGuestOrders(state.commerce.orders);

  const result = planProactiveTurn({
    state,
    config: state.config,
    orders,
    sessionPhase: scenario.setup.sessionPhase,
    payload: {
      ...scenario.payload,
      dismissedNudgeKeys:
        scenario.payload.dismissedNudgeKeys ?? state.conversation.dismissedNudges,
    },
    now: ANTICIPATION_EVAL_NOW,
  });

  const actual = {
    emit: !result.skipped && result.nudge != null,
    kind: result.nudge?.kind ?? result.candidateKind,
    skipReason: result.skipReason,
    planKind: result.turnPlan?.kind ?? null,
    requiresLlm: result.turnPlan?.requiresLlm ?? null,
    message: result.message,
  };

  if (actual.emit !== scenario.expect.emit) {
    errors.push(
      `emit: expected ${scenario.expect.emit}, got ${actual.emit} (skip=${actual.skipReason ?? "none"})`
    );
  }

  if (scenario.expect.kind && actual.kind !== scenario.expect.kind) {
    errors.push(`kind: expected ${scenario.expect.kind}, got ${actual.kind ?? "null"}`);
  }

  if (scenario.expect.skipReason && actual.skipReason !== scenario.expect.skipReason) {
    errors.push(
      `skipReason: expected ${scenario.expect.skipReason}, got ${actual.skipReason ?? "null"}`
    );
  }

  if (scenario.expect.planKind && actual.planKind !== scenario.expect.planKind) {
    errors.push(
      `planKind: expected ${scenario.expect.planKind}, got ${actual.planKind ?? "null"}`
    );
  }

  if (
    scenario.expect.requiresLlm !== undefined &&
    actual.requiresLlm !== scenario.expect.requiresLlm
  ) {
    errors.push(
      `requiresLlm: expected ${scenario.expect.requiresLlm}, got ${actual.requiresLlm}`
    );
  }

  if (scenario.expect.messageIncludes && actual.message) {
    if (
      !actual.message
        .toLowerCase()
        .includes(scenario.expect.messageIncludes.toLowerCase())
    ) {
      errors.push(
        `message must include "${scenario.expect.messageIncludes}", got "${actual.message}"`
      );
    }
  }

  return {
    id: scenario.id,
    description: scenario.description,
    passed: errors.length === 0,
    errors,
    actual: {
      emit: actual.emit,
      kind: actual.kind ?? null,
      skipReason: actual.skipReason,
      planKind: actual.planKind,
      requiresLlm: actual.requiresLlm,
      message: actual.message,
    },
  };
}

/** D-EVAL — proactive brain scenarios (beliefs → TDE → template tell). */
export function runAnticipationEval(): AnticipationReport {
  const results = ANTICIPATION_SCENARIOS.map(runAnticipationScenario);
  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;
  const passRate = results.length ? passed / results.length : 0;

  return {
    ok:
      failed === 0 &&
      results.length >= ANTICIPATION_MIN_SCENARIOS &&
      passRate >= ANTICIPATION_MIN_PASS_RATE,
    scenarioCount: results.length,
    passed,
    failed,
    minPassRate: ANTICIPATION_MIN_PASS_RATE,
    passRate,
    results,
  };
}
