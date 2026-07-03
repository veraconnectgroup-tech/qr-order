import type { GuestScrollPosture } from "@/lib/denis/cognition/mental-model/mental-model-types";
import { orchestrateTableLifecycle } from "@/lib/denis/cognition/lifecycle/orchestrate-table-lifecycle";
import type { TableLifecycleOrchestration } from "@/lib/denis/cognition/lifecycle/table-lifecycle-types";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";
import {
  detectTableTempoPhase,
  type TableTempoPhase,
} from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { TurnPlan } from "@/lib/denis/cognition/tde/turn-plan-types";
import type { ConciergeConfig } from "@/lib/denis/config/concierge-config.schema";
import {
  avgDrinkDurationMinutes,
  DRINK_DURATION_MINUTES,
} from "@/lib/denis/intelligence/drink-sommelier";
import {
  buildWeatherSuggestion,
  type WeatherConditionKind,
} from "@/lib/denis/intelligence/weather-context";
import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { MenuEngineeringInsight } from "@/lib/denis/platform/menu-engineering";
import {
  shouldOfferDessert,
  shouldOfferStarter,
} from "@/lib/denis/platform/guest-memory-format";
import type { GuestMemoryProjection } from "@/lib/denis/platform/guest-memory-types";
import type { OrderFact, TableSessionState } from "@/lib/denis/loop/types";

/** High-level QR → goodbye phases (Phase 3 conductor). */
export type TableLifecyclePhase =
  | "welcome"
  | "browsing"
  | "first_drink"
  | "ordering"
  | "waiting_food"
  | "eating"
  | "drink_refill"
  | "between_courses"
  | "dessert_window"
  | "settling"
  | "goodbye";

export type TableLifecycleAction =
  | { kind: "speak"; message: string }
  | { kind: "silence"; reason: string }
  | { kind: "nudge"; nudgeKind: GuestProactiveNudgeKind | string }
  | { kind: "staff_hint"; hint: string }
  | { kind: "update_mental_model"; updates: Record<string, unknown> };

export type TableLifecycleTransition = {
  from: TableLifecyclePhase;
  to: TableLifecyclePhase;
  trigger: string;
  action: TableLifecycleAction;
};

export type OrchestrateTableLifecycleInput = {
  phase: TableLifecyclePhase;
  minutesSinceDelivery?: number;
  drinkEstimatedEmpty?: boolean;
  drinkFamily?: string;
  guestMemory?: GuestMemoryProjection | null;
  idleMinutes?: number;
  scrollReachedBottom?: boolean;
  orderConfirmed?: boolean;
  waitExceedsThreshold?: boolean;
  foodDelivered?: boolean;
  billPaid?: boolean;
  browsingStalled?: boolean;
  postMealIdle?: boolean;
  menuInsight?: MenuEngineeringInsight | null;
  weatherCondition?: WeatherConditionKind | null;
  weatherTempC?: number | null;
  language?: string;
};

export type OrchestrateTableLifecycleResult = {
  phase: TableLifecyclePhase;
  action: TableLifecycleAction;
  trigger: string | null;
};

const CLOSED_ORDER = new Set(["cancelled", "rejected"]);

function starRecommendationHint(
  menuInsight: MenuEngineeringInsight | null | undefined
): string {
  const stars = menuInsight?.byCategory.star.slice(0, 2).map((row) => row.name);
  if (!stars?.length) {
    return "Recommend a popular house specialty from the menu.";
  }
  return `Recommend menu stars: ${stars.join(", ")}.`;
}

function welcomeWeatherHook(input: {
  weatherCondition?: WeatherConditionKind | null;
  weatherTempC?: number | null;
  language?: string;
}): string {
  if (input.weatherCondition == null || input.weatherTempC == null) {
    return "Welcome — offer drink or food.";
  }
  const copy = buildWeatherSuggestion(
    input.weatherCondition,
    input.weatherTempC,
    input.language ?? "sr"
  );
  return copy.suggestion;
}

/** Declarative lifecycle transitions — conductor sheet (Phase 3). */
export const TABLE_LIFECYCLE_TRANSITIONS: TableLifecycleTransition[] = [
  {
    from: "welcome",
    to: "browsing",
    trigger: "guest_opened_menu",
    action: { kind: "silence", reason: "Let guest browse" },
  },
  {
    from: "browsing",
    to: "first_drink",
    trigger: "browsing_stalled_3min",
    action: { kind: "nudge", nudgeKind: "drink_suggestion" },
  },
  {
    from: "browsing",
    to: "browsing",
    trigger: "scroll_reached_bottom",
    action: {
      kind: "speak",
      message: "use menu engineering stars for recommendation",
    },
  },
  {
    from: "ordering",
    to: "waiting_food",
    trigger: "order_confirmed",
    action: {
      kind: "speak",
      message: "confirm + ETA + drink pairing from sommelier",
    },
  },
  {
    from: "waiting_food",
    to: "waiting_food",
    trigger: "wait_exceeds_threshold",
    action: {
      kind: "speak",
      message: "proactive wait update + offer appetizer",
    },
  },
  {
    from: "waiting_food",
    to: "eating",
    trigger: "food_delivered",
    action: {
      kind: "silence",
      reason: "Never interrupt eating. Denis ĆUTI.",
    },
  },
  {
    from: "eating",
    to: "drink_refill",
    trigger: "drink_estimated_empty",
    action: { kind: "nudge", nudgeKind: "drink_refill" },
  },
  {
    from: "eating",
    to: "dessert_window",
    trigger: "post_meal_idle",
    action: { kind: "nudge", nudgeKind: "dessert_suggestion" },
  },
  {
    from: "dessert_window",
    to: "settling",
    trigger: "guest_idle_5min",
    action: { kind: "speak", message: "offer coffee or bill" },
  },
  {
    from: "settling",
    to: "goodbye",
    trigger: "bill_paid",
    action: {
      kind: "speak",
      message: "thanks + loyalty update + soft review",
    },
  },
];

function drinkEstimatedEmpty(input: {
  minutesSinceDelivery?: number;
  drinkFamily?: string;
  drinkEstimatedEmpty?: boolean;
}): boolean {
  if (input.drinkEstimatedEmpty === true) return true;
  if (input.minutesSinceDelivery == null) return false;
  const family = input.drinkFamily ?? "beer";
  const duration =
    DRINK_DURATION_MINUTES[family] ??
    avgDrinkDurationMinutes("piće", { drinkFamily: family });
  return input.minutesSinceDelivery >= Math.round(duration * 0.8);
}

function resolveActiveTrigger(
  input: OrchestrateTableLifecycleInput
): string | null {
  if (input.billPaid) return "bill_paid";
  if (input.postMealIdle && input.phase === "dessert_window") {
    return "guest_idle_5min";
  }
  if (input.postMealIdle && input.phase === "eating") {
    return "post_meal_idle";
  }
  if (input.phase === "eating" && drinkEstimatedEmpty(input)) {
    return "drink_estimated_empty";
  }
  if (input.foodDelivered && input.phase === "waiting_food") {
    return "food_delivered";
  }
  if (input.waitExceedsThreshold && input.phase === "waiting_food") {
    return "wait_exceeds_threshold";
  }
  if (input.orderConfirmed && input.phase === "ordering") {
    return "order_confirmed";
  }
  if (input.scrollReachedBottom && input.phase === "browsing") {
    return "scroll_reached_bottom";
  }
  if (input.browsingStalled && input.phase === "browsing") {
    return "browsing_stalled_3min";
  }
  if (input.phase === "welcome") return "guest_opened_menu";
  return null;
}

function enrichAction(
  transition: TableLifecycleTransition,
  input: OrchestrateTableLifecycleInput
): TableLifecycleAction {
  const action = transition.action;

  if (action.kind === "speak" && action.message.includes("menu engineering")) {
    return {
      kind: "speak",
      message: starRecommendationHint(input.menuInsight),
    };
  }

  if (
    transition.trigger === "post_meal_idle" &&
    action.kind === "nudge" &&
    action.nudgeKind === "dessert_suggestion"
  ) {
    if (!shouldOfferDessert(input.guestMemory)) {
      return {
        kind: "speak",
        message: "offer coffee or bill — guest skips dessert",
      };
    }
  }

  if (
    transition.trigger === "wait_exceeds_threshold" &&
    action.kind === "speak" &&
    !shouldOfferStarter(input.guestMemory)
  ) {
    return {
      kind: "speak",
      message: "proactive wait update — no starter upsell for this guest",
    };
  }

  if (transition.from === "welcome" && action.kind === "silence") {
    return {
      kind: "speak",
      message: welcomeWeatherHook(input),
    };
  }

  return action;
}

/** Evaluate lifecycle transitions for the current phase (Phase 3 conductor). */
export function orchestrate(
  input: OrchestrateTableLifecycleInput
): OrchestrateTableLifecycleResult {
  if (
    input.phase === "dessert_window" &&
    !shouldOfferDessert(input.guestMemory)
  ) {
    return {
      phase: "settling",
      action: {
        kind: "speak",
        message: "offer coffee or bill — guest prefers main only",
      },
      trigger: "guest_skips_dessert",
    };
  }

  if (input.phase === "eating" && !drinkEstimatedEmpty(input)) {
    return {
      phase: "eating",
      action: {
        kind: "silence",
        reason: "Never interrupt eating. Denis ĆUTI.",
      },
      trigger: null,
    };
  }

  const trigger = resolveActiveTrigger(input);
  if (!trigger) {
    if (input.phase === "eating") {
      return {
        phase: "eating",
        action: {
          kind: "silence",
          reason: "Never interrupt eating. Denis ĆUTI.",
        },
        trigger: null,
      };
    }
    return {
      phase: input.phase,
      action: { kind: "silence", reason: `No transition for ${input.phase}` },
      trigger: null,
    };
  }

  const transition =
    TABLE_LIFECYCLE_TRANSITIONS.find(
      (row) => row.from === input.phase && row.trigger === trigger
    ) ??
    TABLE_LIFECYCLE_TRANSITIONS.find((row) => row.trigger === trigger);

  if (!transition) {
    return {
      phase: input.phase,
      action: { kind: "silence", reason: `Unhandled trigger ${trigger}` },
      trigger,
    };
  }

  return {
    phase: transition.to,
    action: enrichAction(transition, input),
    trigger,
  };
}

function minutesSince(iso: string | null | undefined, nowMs: number): number {
  if (!iso) return 0;
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, (nowMs - ts) / 60_000);
}

function latestFoodDeliveryMinutes(
  orders: OrderFact[],
  nowMs: number
): number | null {
  let latest: number | null = null;
  for (const order of orders) {
    if (CLOSED_ORDER.has(order.status)) continue;
    if (order.status !== "delivered") continue;
    const hasFood = order.items.some((item) => item.menuSection !== "drinks");
    if (!hasFood) continue;
    const deliveredAt = order.deliveredAt ?? order.createdAt;
    const elapsed = minutesSince(deliveredAt, nowMs);
    latest = latest == null ? elapsed : Math.max(latest, elapsed);
  }
  return latest;
}

function resolvePhaseFromSession(input: {
  mental: GuestMentalModel | null | undefined;
  orders: OrderFact[];
  cartLineCount: number;
  billSettled: boolean;
  sessionOpenedAt?: string | null;
  tableTempoPhase: TableTempoPhase;
  scrollPosture: GuestScrollPosture;
}): TableLifecyclePhase {
  if (input.billSettled) return "goodbye";
  if (input.mental?.intent === "paying" || input.mental?.intent === "finishing") {
    return "settling";
  }
  if (
    input.mental?.mealStage === "dessert_window" ||
    input.tableTempoPhase === "post_meal_idle"
  ) {
    return "dessert_window";
  }
  if (input.mental?.intent === "eating") return "eating";
  if (
    input.mental?.intent === "waiting_food" ||
    input.orders.some((order) =>
      ["pending", "accepted", "preparing"].includes(order.status)
    )
  ) {
    return "waiting_food";
  }
  if (input.mental?.mealStage === "between_courses") return "between_courses";
  if (
    input.mental?.intent === "ordering" ||
    input.mental?.intent === "decided" ||
    input.cartLineCount > 0
  ) {
    return "ordering";
  }
  if (input.tableTempoPhase === "browsing_stalled") return "first_drink";
  if (input.scrollPosture.readyForRecommendation) return "browsing";
  if (input.mental?.intent === "arrived" && input.orders.length === 0) {
    return input.sessionOpenedAt ? "welcome" : "browsing";
  }
  return "browsing";
}

export type OrchestrateTableLifecycleTurnInput = {
  state: Pick<
    TableSessionState,
    "mental" | "commerce" | "config" | "timeline" | "session" | "browse"
  >;
  guestMemory?: GuestMemoryProjection | null;
  menuInsight?: MenuEngineeringInsight | null;
  sessionOpenedAt?: string | null;
  language?: string;
  weatherCondition?: WeatherConditionKind | null;
  weatherTempC?: number | null;
  nowMs?: number;
};

export type OrchestrateTableLifecycleTurnResult = OrchestrateTableLifecycleResult & {
  orchestration: TableLifecycleOrchestration;
};

/** Full turn resolver — tempo + scroll + sommelier + guest memory → action. */
export function orchestrateTableLifecycleTurn(
  input: OrchestrateTableLifecycleTurnInput
): OrchestrateTableLifecycleTurnResult {
  const nowMs = input.nowMs ?? Date.now();
  const mental = input.state.mental;
  const scrollPosture = mental?.scrollPosture ?? {
    searching: false,
    deferUpsell: false,
    readyForRecommendation: false,
    focusedCategory: null,
    latestIntent: null,
  };

  const tableTempoPhase =
    input.state.config.ops.tableTempo.enabled && input.sessionOpenedAt
      ? detectTableTempoPhase({
          sessionOpenedAt: input.sessionOpenedAt,
          orders: input.state.commerce.orders,
          guestMessageCount: 0,
          idleMinutes: 0,
          config: input.state.config.ops.tableTempo,
          nowMs,
        })
      : ("none" as const);

  const phase = resolvePhaseFromSession({
    mental,
    orders: input.state.commerce.orders,
    cartLineCount: input.state.commerce.cart.visibleLines.length,
    billSettled: input.state.session.billSettled,
    sessionOpenedAt: input.sessionOpenedAt,
    tableTempoPhase,
    scrollPosture,
  });

  const minutesSinceDelivery = latestFoodDeliveryMinutes(
    input.state.commerce.orders,
    nowMs
  );

  const lifecycleResult = orchestrate({
    phase,
    minutesSinceDelivery: minutesSinceDelivery ?? undefined,
    drinkEstimatedEmpty:
      tableTempoPhase === "drinks_finished_estimate" ||
      (phase === "eating" &&
        minutesSinceDelivery != null &&
        drinkEstimatedEmpty({
          minutesSinceDelivery,
          drinkFamily: "beer",
        })),
    drinkFamily: "beer",
    guestMemory: input.guestMemory,
    scrollReachedBottom: scrollPosture.readyForRecommendation,
    orderConfirmed: phase === "ordering" && mental?.intent === "decided",
    waitExceedsThreshold:
      phase === "waiting_food" &&
      input.state.commerce.orders.some(
        (order) =>
          ["pending", "accepted", "preparing"].includes(order.status) &&
          minutesSince(order.createdAt, nowMs) >=
            input.state.config.proactive.orderDelayMinutes
      ),
    foodDelivered: input.state.commerce.orders.some(
      (order) => order.status === "delivered"
    ),
    billPaid: input.state.session.billSettled,
    browsingStalled: tableTempoPhase === "browsing_stalled",
    postMealIdle: tableTempoPhase === "post_meal_idle",
    menuInsight: input.menuInsight,
    weatherCondition: input.weatherCondition,
    weatherTempC: input.weatherTempC,
    language: input.language,
  });

  const orchestration = orchestrateTableLifecycle({
    mental,
    tableTempoPhase,
    orders: input.state.commerce.orders,
    cartLineCount: input.state.commerce.cart.visibleLines.length,
  });

  return {
    ...lifecycleResult,
    orchestration,
  };
}

/** Proactive / upsell turns respect eating silence; guest orders do not. */
export function shouldApplyLifecycleSilence(input: {
  lifecycle: OrchestrateTableLifecycleResult;
  turnPlan: TurnPlan;
  guestMessage: string;
}): boolean {
  if (input.lifecycle.action.kind !== "silence") return false;

  if (input.turnPlan.kind === "transactional_perceive") return false;
  if (input.turnPlan.kind === "slot_extract") return false;
  if (input.turnPlan.reason?.startsWith("commerce.")) return false;
  if (input.turnPlan.reason?.startsWith("waiter.")) return false;
  if (input.guestMessage.trim().length > 0) return false;

  return true;
}

export function lifecycleSilenceGuestMessage(
  language: string | undefined
): string {
  switch (language) {
    case "de":
      return "Guten Appetit!";
    case "en":
      return "Enjoy your meal!";
    default:
      return "Prijatno!";
  }
}

export function resolveInterventionSpeakAllowed(config: ConciergeConfig): boolean {
  return config.intervention.mode !== "off";
}
