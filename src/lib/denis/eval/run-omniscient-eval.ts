import type { AiGuestOrder } from "@/lib/ai/order-context";
import { retrieveCommerceEvidence } from "@/lib/denis/cognition/context/retrievers/commerce-evidence";
import { retrieveVenueOpsEvidence } from "@/lib/denis/cognition/context/retrievers/venue-ops-evidence";
import {
  formatCommerceGuestWaitingLine,
  deriveCommerceLifecycleFacts,
} from "@/lib/denis/cognition/beliefs/compile-commerce-lifecycle";
import {
  buildSlowKitchenMessage,
} from "@/lib/denis/cognition/proactive/proactive-message-builders";
import { detectSlowKitchenTrigger } from "@/lib/denis/cognition/proactive/triggers";
import { planProactiveTurn } from "@/lib/denis/cognition/proactive/plan-proactive-turn";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";
import {
  locationPrepTimePriorsFromJson,
  resolvePrepTimeEstimate,
} from "@/lib/denis/config/prep-time-priors";
import { resolveRhythmPriors } from "@/lib/denis/config/resolve-rhythm-priors";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  OMNISCIENT_MIN_PASS_RATE,
  OMNISCIENT_MIN_SCENARIOS,
  OMNISCIENT_SCENARIOS,
} from "@/lib/denis/eval/fixtures/omniscient/scenarios";
import { OMNISCIENT_EVAL_NOW } from "@/lib/denis/eval/fixtures/omniscient/helpers";
import type {
  OmniscientCheck,
  OmniscientReport,
  OmniscientScenario,
  OmniscientScenarioResult,
} from "@/lib/denis/eval/omniscient-types";
import { buildDenisDock } from "@/lib/denis/loop/build-denis-dock";
import {
  computeStationQueues,
  deriveHouseUnderstaffedHint,
  deriveOpsPlannerEffects,
  shouldAutoRushFromFloor,
} from "@/lib/denis/loop/omniscient-eval-bridge";
import { resolveWorldOrderTell } from "@/lib/denis/loop/tell-world-order";
import type { OrderFact, TableSessionState } from "@/lib/denis/loop/types";
import { emptyCartState } from "@/lib/denis/kernel/cart-projection";
import { buildMergedCart } from "@/lib/denis/loop/merge-session-cart";
import { emptyBrowseProfile } from "@/lib/denis/cognition/browse/browse-types";
import { emptyConversationModel } from "@/lib/denis/cognition/conversation/empty-conversation-model";
import { emptyGuestMentalModel } from "@/lib/denis/cognition/mental-model/empty-mental-model";
import { emptyGuestOfferContext } from "@/lib/denis/cognition/offer/empty-guest-offer-context";
import type { AnticipationSetup } from "@/lib/denis/eval/anticipation-types";

function includesAll(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.every((needle) => lower.includes(needle.toLowerCase()));
}

function excludesAll(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.every((needle) => !lower.includes(needle.toLowerCase()));
}

function buildMinimalState(orders: OrderFact[] = []): TableSessionState {
  return {
    table: { id: "table-4", name: "Table 4", token: "tok" },
    session: {
      id: "sess-omni",
      status: "active",
      accessState: null,
      billSettled: false,
      feedbackSubmitted: false,
      denisEnabled: true,
      denisActive: true,
    },
    commerce: {
      orders,
      cart: buildMergedCart({ ai: emptyCartState() }),
    },
    venue: {
      ops: {
        operatingMode: "normal",
        kdsStress: "normal",
        acceptingOrders: true,
        unavailableProductIds: [],
        staffHint: null,
        stationStress: [],
      },
      opsEffects: {
        skipUpsell: false,
        shortenReplies: false,
        empathyNote: null,
        guestSafeStaffHint: null,
      },
    },
    conversation: {
      flowNodeId: "browse",
      foodUpsellAsked: false,
      dismissedNudges: [],
      lastAssistantMessage: null,
      pendingSlot: null,
      model: emptyConversationModel(),
      obligation: null,
    },
    timeline: [],
    browse: emptyBrowseProfile(),
    mental: emptyGuestMentalModel(OMNISCIENT_EVAL_NOW),
    offer: emptyGuestOfferContext(),
    config: CONCIERGE_PLATFORM_DEFAULTS,
  };
}

function buildAnticipationState(setup: AnticipationSetup): TableSessionState {
  const config: ConciergeConfig = {
    ...CONCIERGE_PLATFORM_DEFAULTS,
    proactive: {
      ...CONCIERGE_PLATFORM_DEFAULTS.proactive,
      enabled: setup.proactiveEnabled ?? true,
      pairing: setup.pairingEnabled ?? true,
      dessert: setup.dessertEnabled ?? true,
      slowKitchen: setup.slowKitchenEnabled ?? true,
    },
  };

  const state = buildMinimalState(setup.orders ?? []);
  state.config = config;
  state.session.billSettled = setup.sessionPhase === "settling";
  state.venue.ops.operatingMode = setup.operatingMode ?? "normal";
  state.venue.opsEffects.skipUpsell = setup.skipUpsell ?? false;
  state.conversation.dismissedNudges = setup.dismissedNudges ?? [];
  return state;
}

function orderFactsToGuestOrders(orders: OrderFact[]): AiGuestOrder[] {
  return orders.map((order) => ({
    id: order.id,
    status: order.status,
    created_at: order.createdAt,
    delivered_at: order.status === "delivered" ? order.createdAt : null,
    estimated_prep_minutes: order.estimatedPrepMinutes,
    prep_estimate_confidence: order.prepEstimateConfidence ?? "none",
    order_items: order.items.map((item) => ({
      product_id: item.productId ?? null,
      product_name: item.productName,
      unit_price: item.lineTotalCents ?? 0,
      quantity: item.quantity,
      menu_section:
        item.menuSection === "drinks" || item.menuSection === "desserts"
          ? item.menuSection
          : "food",
    })),
  }));
}

function evaluateProactiveCheck(
  check: Extract<OmniscientCheck, { type: "proactive" }>
): string[] {
  const state = buildAnticipationState(check.setup);
  const orders = orderFactsToGuestOrders(state.commerce.orders);
  const result = planProactiveTurn({
    state,
    config: state.config,
    orders,
    sessionPhase: check.setup.sessionPhase,
    payload: {
      ...check.payload,
      dismissedNudgeKeys:
        check.payload?.dismissedNudgeKeys ?? state.conversation.dismissedNudges,
    },
    now: OMNISCIENT_EVAL_NOW,
  });

  const errors: string[] = [];
  const emit = !result.skipped && result.nudge != null;

  if (emit !== check.expect.emit) {
    errors.push(
      `emit: expected ${check.expect.emit}, got ${emit} (skip=${result.skipReason ?? "none"})`
    );
  }
  if (check.expect.kind && result.nudge?.kind !== check.expect.kind) {
    errors.push(
      `kind: expected ${check.expect.kind}, got ${result.nudge?.kind ?? "null"}`
    );
  }
  if (
    check.expect.skipReason &&
    result.skipReason !== check.expect.skipReason
  ) {
    errors.push(
      `skipReason: expected ${check.expect.skipReason}, got ${result.skipReason ?? "null"}`
    );
  }
  if (
    check.expect.planKind &&
    result.turnPlan?.kind !== check.expect.planKind
  ) {
    errors.push(
      `planKind: expected ${check.expect.planKind}, got ${result.turnPlan?.kind ?? "null"}`
    );
  }
  if (
    check.expect.requiresLlm !== undefined &&
    result.turnPlan?.requiresLlm !== check.expect.requiresLlm
  ) {
    errors.push(
      `requiresLlm: expected ${check.expect.requiresLlm}, got ${result.turnPlan?.requiresLlm ?? "null"}`
    );
  }

  return errors;
}

function evaluateCheck(check: OmniscientCheck): string[] {
  const errors: string[] = [];

  switch (check.type) {
    case "dock": {
      const orders = check.orders ?? [];
      const hasReady = orders.some((order) => order.status === "ready");
      const dock = buildDenisDock({
        state: buildMinimalState(orders),
        meta: {
          truthHash: "omni",
          orderCount: orders.length,
          phase: check.phase,
          tableSessionId: "sess-omni",
          draftAiSessionId: null,
        },
        situation: hasReady
          ? {
              headline: "ready",
              orders: [],
              hasReadyOrder: true,
              hasActiveKitchen: false,
            }
          : null,
        language: check.language ?? "sr",
        nowMs: OMNISCIENT_EVAL_NOW,
      });

      if (
        check.headlineIncludes &&
        !includesAll(dock.headline, check.headlineIncludes)
      ) {
        errors.push(
          `headline "${dock.headline}" missing ${check.headlineIncludes.join(", ")}`
        );
      }
      if (
        check.headlineExcludes &&
        !excludesAll(dock.headline, check.headlineExcludes)
      ) {
        errors.push(
          `headline "${dock.headline}" must exclude ${check.headlineExcludes.join(", ")}`
        );
      }
      if (check.sublineIncludes && dock.subline) {
        if (!includesAll(dock.subline, check.sublineIncludes)) {
          errors.push(
            `subline "${dock.subline}" missing ${check.sublineIncludes.join(", ")}`
          );
        }
      } else if (check.sublineIncludes && !dock.subline) {
        errors.push("expected subline but got null");
      }
      if (check.urgency && dock.urgency !== check.urgency) {
        errors.push(`urgency: expected ${check.urgency}, got ${dock.urgency}`);
      }
      if (check.chipActions) {
        const actions = dock.chips.map((chip) => chip.action);
        for (const action of check.chipActions) {
          if (!actions.includes(action)) {
            errors.push(`missing dock chip action ${action}`);
          }
        }
      }
      break;
    }

    case "proactive":
      return evaluateProactiveCheck(check);

    case "station_queues": {
      const queues = computeStationQueues(
        check.orders.map((order) => ({
          status: order.status,
          created_at: order.created_at,
          accepted_at: order.accepted_at ?? null,
          preparing_at: order.preparing_at ?? null,
          order_items: order.order_items,
        })),
        OMNISCIENT_EVAL_NOW
      );
      const kitchen = queues.find((row) => row.station === "kitchen");
      const bar = queues.find((row) => row.station === "bar");

      if (
        check.expect.kitchenCount != null &&
        (kitchen?.activeOrderCount ?? 0) !== check.expect.kitchenCount
      ) {
        errors.push(
          `kitchenCount: expected ${check.expect.kitchenCount}, got ${kitchen?.activeOrderCount ?? 0}`
        );
      }
      if (
        check.expect.barCount != null &&
        (bar?.activeOrderCount ?? 0) !== check.expect.barCount
      ) {
        errors.push(
          `barCount: expected ${check.expect.barCount}, got ${bar?.activeOrderCount ?? 0}`
        );
      }
      if (
        check.expect.kitchenAvgMin != null &&
        kitchen?.avgWaitMinutes !== check.expect.kitchenAvgMin
      ) {
        errors.push(
          `kitchenAvgMin: expected ${check.expect.kitchenAvgMin}, got ${kitchen?.avgWaitMinutes ?? "null"}`
        );
      }
      if (
        check.expect.barAvgMin != null &&
        bar?.avgWaitMinutes !== check.expect.barAvgMin
      ) {
        errors.push(
          `barAvgMin: expected ${check.expect.barAvgMin}, got ${bar?.avgWaitMinutes ?? "null"}`
        );
      }
      break;
    }

    case "prep_estimate": {
      const priors = locationPrepTimePriorsFromJson(check.priors);
      const estimate = resolvePrepTimeEstimate(
        priors,
        check.items,
        check.isRush ?? false
      );
      if (estimate.etaMinutes !== check.expectMinutes) {
        errors.push(
          `etaMinutes: expected ${check.expectMinutes}, got ${estimate.etaMinutes}`
        );
      }
      if (estimate.confidence !== check.expectConfidence) {
        errors.push(
          `confidence: expected ${check.expectConfidence}, got ${estimate.confidence}`
        );
      }
      break;
    }

    case "world_tell": {
      const locale = check.locale ?? "sr";
      const tell = resolveWorldOrderTell({
        signal: "commerce.order_status",
        status: check.status,
        previousStatus: "accepted",
        orderNumber: 42,
        menuLocale: locale === "en" ? "sr" : locale,
        isEnglish: locale === "en",
        orders: [
          {
            id: "o1",
            orderNumber: 42,
            status: check.status,
            items: check.items,
          },
        ],
      });

      if (!tell) {
        errors.push("world tell returned null");
        break;
      }

      if (tell.push !== check.expectPush) {
        errors.push(`push: expected ${check.expectPush}, got ${tell.push}`);
      }
      if (tell.persistTell !== check.expectPersistTell) {
        errors.push(
          `persistTell: expected ${check.expectPersistTell}, got ${tell.persistTell}`
        );
      }
      if (
        check.messageIncludes &&
        !includesAll(tell.message, check.messageIncludes)
      ) {
        errors.push(
          `message "${tell.message}" missing ${check.messageIncludes.join(", ")}`
        );
      }
      break;
    }

    case "slow_kitchen": {
      const orders: AiGuestOrder[] = check.orders.map((order) => ({
        id: order.id,
        status: order.status,
        created_at: order.created_at,
        delivered_at: null,
        estimated_prep_minutes: order.estimated_prep_minutes,
        prep_estimate_confidence: order.prep_estimate_confidence ?? "none",
        order_items: [
          {
            product_id: order.id,
            product_name: order.product_name ?? "Item",
            unit_price: 10,
            quantity: 1,
            menu_section: order.menu_section ?? "food",
          },
        ],
      }));

      const trigger = detectSlowKitchenTrigger(orders, () => false, OMNISCIENT_EVAL_NOW);
      if (check.expectFires && !trigger) {
        errors.push("expected slow_kitchen trigger to fire");
      }
      if (!check.expectFires && trigger) {
        errors.push("expected slow_kitchen trigger to stay silent");
      }

      if (trigger) {
        const message = buildSlowKitchenMessage({
          language: "sr",
          waitMinutes: trigger.waitMinutes ?? 0,
          remainingEtaMinutes: trigger.remainingEtaMinutes ?? null,
          estimatedPrepMinutes: trigger.estimatedPrepMinutes ?? null,
          prepEstimateConfidence: trigger.prepEstimateConfidence ?? "none",
          delaySeverity: trigger.delaySeverity ?? "mild",
          offerDrink: check.expectDrinkOffer ?? false,
        });

        if (check.messageIncludes && !includesAll(message, check.messageIncludes)) {
          errors.push(
            `message "${message}" missing ${check.messageIncludes.join(", ")}`
          );
        }
        if (
          check.messageForbidden &&
          !excludesAll(message, check.messageForbidden)
        ) {
          errors.push(
            `message "${message}" must not include ${check.messageForbidden.join(", ")}`
          );
        }

        const drinkOffered = /offer a drink|suggest a drink/i.test(trigger.prompt);
        if (
          check.expectDrinkOffer != null &&
          drinkOffered !== check.expectDrinkOffer
        ) {
          errors.push(
            `drink offer in prompt: expected ${check.expectDrinkOffer}, got ${drinkOffered}`
          );
        }
      }
      break;
    }

    case "rhythm": {
      const config: ConciergeConfig = {
        ...CONCIERGE_PLATFORM_DEFAULTS,
        rhythm: {
          ...CONCIERGE_PLATFORM_DEFAULTS.rhythm,
          enabled: true,
          mode: "shadow",
        },
      };
      const rhythm = resolveRhythmPriors({
        config,
        priors: check.priors,
        now: new Date(check.nowIso),
        timezone: check.timezone ?? "Europe/Berlin",
      });

      if (
        check.expectSlotStress &&
        rhythm.currentSlotStress !== check.expectSlotStress
      ) {
        errors.push(
          `slotStress: expected ${check.expectSlotStress}, got ${rhythm.currentSlotStress ?? "null"}`
        );
      }

      if (check.expectSkipUpsell != null) {
        const opsEffects = deriveOpsPlannerEffects(
          {
            operatingMode: check.expectSkipUpsell ? "rush" : "normal",
            kdsStress: check.expectSkipUpsell ? "high" : "normal",
            acceptingOrders: true,
            unavailableProductIds: [],
            staffHint: null,
            stationStress: [],
          },
          config
        );
        if (opsEffects.skipUpsell !== check.expectSkipUpsell) {
          errors.push(
            `skipUpsell: expected ${check.expectSkipUpsell}, got ${opsEffects.skipUpsell}`
          );
        }
      }
      break;
    }

    case "floor": {
      const hint = deriveHouseUnderstaffedHint({
        staffOnFloor: check.staffOnFloor,
        activeOrderCount: check.activeOrderCount,
      });
      if (hint !== check.expectHouseHint) {
        errors.push(
          `houseHint: expected ${check.expectHouseHint ?? "null"}, got ${hint ?? "null"}`
        );
      }

      if (check.expectAutoRush != null) {
        const rush = shouldAutoRushFromFloor(
          {
            house: {
              operatingMode: "normal",
              kdsBacklogMinutes: check.kdsBacklogMinutes ?? null,
              activeOrderCount: check.activeOrderCount,
              staffOnFloor: check.staffOnFloor,
              houseHint: hint,
              stationQueues: [],
            },
            tables: [],
          },
          {
            ops: {
              ...CONCIERGE_PLATFORM_DEFAULTS.ops,
              autoRushEnabled: true,
              autoRushBacklogMinutes: 20,
            },
          }
        );
        if (rush !== check.expectAutoRush) {
          errors.push(
            `autoRush: expected ${check.expectAutoRush}, got ${rush}`
          );
        }
      }

      if (check.expectStaffInEvidence && check.staffOnFloor != null) {
        const evidence = retrieveVenueOpsEvidence(
          {
            operatingMode: "normal",
            kdsStress: "normal",
            acceptingOrders: true,
            unavailableProductIds: [],
            staffHint: null,
            stationStress: [],
            staffOnFloor: check.staffOnFloor,
            houseHint: hint,
          },
          null
        );
        if (!evidence.includes(`Staff on floor: ${check.staffOnFloor}`)) {
          errors.push("venue ops evidence missing staff on floor");
        }
      }
      break;
    }

    case "commerce_lifecycle": {
      const facts = deriveCommerceLifecycleFacts(
        check.orders,
        check.venueOps,
        OMNISCIENT_EVAL_NOW
      );

      if (
        check.expectAnyLate != null &&
        facts.anyLate !== check.expectAnyLate
      ) {
        errors.push(
          `anyLate: expected ${check.expectAnyLate}, got ${facts.anyLate}`
        );
      }
      if (
        check.expectKitchenEta !== undefined &&
        facts.kitchenEtaMinutes !== check.expectKitchenEta
      ) {
        errors.push(
          `kitchenEta: expected ${check.expectKitchenEta}, got ${facts.kitchenEtaMinutes}`
        );
      }
      if (
        check.expectBarEta !== undefined &&
        facts.barEtaMinutes !== check.expectBarEta
      ) {
        errors.push(
          `barEta: expected ${check.expectBarEta}, got ${facts.barEtaMinutes}`
        );
      }

      const waitingLine = formatCommerceGuestWaitingLine(facts);
      if (check.waitingLineIncludes && waitingLine) {
        if (!includesAll(waitingLine, check.waitingLineIncludes)) {
          errors.push(`waiting line "${waitingLine}" missing tokens`);
        }
      }
      if (check.waitingLineExcludes && waitingLine) {
        if (!excludesAll(waitingLine, check.waitingLineExcludes)) {
          errors.push(`waiting line "${waitingLine}" has forbidden tokens`);
        }
      }
      break;
    }

    case "commerce_evidence": {
      const state = buildMinimalState(check.orders);
      const evidence = retrieveCommerceEvidence(state, null, null, {
        nowMs: OMNISCIENT_EVAL_NOW,
      });
      if (check.includes && !includesAll(evidence, check.includes)) {
        errors.push(`commerce evidence missing ${check.includes.join(", ")}`);
      }
      if (check.excludes && !excludesAll(evidence, check.excludes)) {
        errors.push(`commerce evidence must exclude ${check.excludes.join(", ")}`);
      }
      break;
    }

    case "venue_ops_evidence": {
      const evidence = retrieveVenueOpsEvidence(check.venueOps, null);
      if (check.includes && !includesAll(evidence, check.includes)) {
        errors.push(`venue ops evidence missing ${check.includes.join(", ")}`);
      }
      break;
    }

    default:
      errors.push("unknown omniscient check type");
  }

  return errors;
}

function runOmniscientScenario(
  scenario: OmniscientScenario
): OmniscientScenarioResult {
  const errors = evaluateCheck(scenario.check);
  return {
    id: scenario.id,
    description: scenario.description,
    category: scenario.category,
    passed: errors.length === 0,
    errors,
  };
}

/** E1 — full omniscient eval (kitchen, bar, ETA, rhythm, proactive, dock, floor). */
export function runOmniscientEval(): OmniscientReport {
  const results = OMNISCIENT_SCENARIOS.map(runOmniscientScenario);
  const passed = results.filter((row) => row.passed).length;
  const failed = results.length - passed;
  const passRate = results.length ? passed / results.length : 0;

  return {
    ok:
      failed === 0 &&
      results.length >= OMNISCIENT_MIN_SCENARIOS &&
      passRate >= OMNISCIENT_MIN_PASS_RATE,
    scenarioCount: results.length,
    passed,
    failed,
    minPassRate: OMNISCIENT_MIN_PASS_RATE,
    passRate,
    results,
  };
}
