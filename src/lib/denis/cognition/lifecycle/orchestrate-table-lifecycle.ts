import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import type { TableLifecycleOrchestration } from "@/lib/denis/cognition/lifecycle/table-lifecycle-types";
import { emptyGuestScrollPosture } from "@/lib/denis/cognition/mental-model/derive-scroll-posture";
import type { PredictiveRecoveryResult } from "@/lib/denis/cognition/recovery/detect-predictive-recovery";
import type { TableTempoPhase } from "@/lib/denis/cognition/tempo/detect-table-tempo-phase";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";
import type { OrderFact } from "@/lib/denis/loop/types";

const CLOSED_ORDER_STATUSES = new Set(["cancelled", "rejected"]);

function hasActiveDrinkOrderFacts(orders: OrderFact[]): boolean {
  return orders.some(
    (order) =>
      !CLOSED_ORDER_STATUSES.has(order.status) &&
      order.items.some((item) => item.menuSection === "drinks")
  );
}

const GENERIC_UPSELL_KINDS: readonly GuestProactiveNudgeKind[] = [
  "browse_nudge",
  "browse_follow_up",
  "popularity_pair",
  "dessert_nudge",
  "happy_hour_upsell",
  "round_two",
  "drink_pairing",
  "cart_recovery",
  "cart_abandonment_prevention",
  "guest_welcome",
];

const SERVICE_KINDS: readonly GuestProactiveNudgeKind[] = [
  "order_delay",
  "order_eta_update",
  "slow_kitchen",
  "order_preparing_notify",
  "bill_prompt",
  "attention_handoff",
];

const UPSELL_KINDS: readonly GuestProactiveNudgeKind[] = [
  ...GENERIC_UPSELL_KINDS,
  "scroll_search",
  "scroll_category",
  "scroll_bottom",
  "sommelier_pairing",
  "sommelier_refill",
  "drink_refill",
  "drink_pairing",
  "table_tempo_browse",
  "dessert_nudge",
  "coffee_nudge",
  "digestif_nudge",
];

function hasPreparingOrder(orders: OrderFact[]): boolean {
  return orders.some((order) =>
    ["pending", "accepted", "preparing"].includes(order.status)
  );
}

function buildResult(input: {
  stage: TableLifecycleOrchestration["stage"];
  lane: TableLifecycleOrchestration["lane"];
  tempoPhase: TableTempoPhase;
  scrollPosture: TableLifecycleOrchestration["scrollPosture"];
  sommelierEligible: boolean;
  evidence: string[];
  preferredKinds: GuestProactiveNudgeKind[];
  suppressedKinds: GuestProactiveNudgeKind[];
}): TableLifecycleOrchestration {
  return {
    stage: input.stage,
    lane: input.lane,
    tempoPhase: input.tempoPhase,
    scrollPosture: input.scrollPosture,
    sommelierEligible: input.sommelierEligible,
    evidence: input.evidence,
    preferredKinds: uniqueKinds(input.preferredKinds),
    suppressedKinds: uniqueKinds(input.suppressedKinds),
  };
}

function uniqueKinds(
  kinds: GuestProactiveNudgeKind[]
): GuestProactiveNudgeKind[] {
  return [...new Set(kinds)];
}

/** One fold — tempo + scroll + sommelier → proactive lane (Phase 2 PR #3). */
export function orchestrateTableLifecycle(input: {
  mental: GuestMentalModel | null | undefined;
  tableTempoPhase: TableTempoPhase;
  orders: OrderFact[];
  cartLineCount: number;
  predictiveRecovery?: PredictiveRecoveryResult | null;
}): TableLifecycleOrchestration {
  const mental = input.mental;
  const scrollPosture = mental?.scrollPosture ?? emptyGuestScrollPosture();
  const evidence: string[] = [];
  const preferredKinds: GuestProactiveNudgeKind[] = [];
  const suppressedKinds: GuestProactiveNudgeKind[] = [];

  if (input.tableTempoPhase !== "none") {
    evidence.push(`tempo.${input.tableTempoPhase}`);
  }

  if (scrollPosture.latestIntent) {
    evidence.push(`scroll.${scrollPosture.latestIntent}`);
  }

  const sommelierEligible =
    hasActiveDrinkOrderFacts(input.orders) &&
    (mental?.mealStage === "main" ||
      mental?.mealStage === "between_courses" ||
      mental?.mealStage === "aperitif");
  if (sommelierEligible) {
    evidence.push("sommelier.eligible");
  }

  if (
    mental?.decline.hardClosed ||
    mental?.receptiveness === "closed" ||
    (mental?.nudgeBudget?.remaining ?? 0) <= 0
  ) {
    return buildResult({
      stage: mental?.intent === "paying" ? "paying" : "browsing",
      lane: "service",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.service_only"],
      preferredKinds: [...SERVICE_KINDS],
      suppressedKinds: [...UPSELL_KINDS],
    });
  }

  if (mental?.intent === "paying" || mental?.intent === "finishing") {
    return buildResult({
      stage: "paying",
      lane: "service",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.paying"],
      preferredKinds: ["bill_prompt"],
      suppressedKinds: [...UPSELL_KINDS],
    });
  }

  if (mental?.intent === "eating") {
    return buildResult({
      stage: "eating",
      lane: "silence",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.eating_silence"],
      preferredKinds: [],
      suppressedKinds: [...UPSELL_KINDS],
    });
  }

  if (mental?.intent === "waiting_food" || hasPreparingOrder(input.orders)) {
    const kitchenDelayProactive = input.predictiveRecovery?.signals.includes(
      "kitchen_delay_proactive"
    );
    const preferred: GuestProactiveNudgeKind[] = kitchenDelayProactive
      ? ["slow_kitchen", "order_eta_update", "order_preparing_notify", "order_delay"]
      : ["order_eta_update", "order_preparing_notify", "slow_kitchen", "order_delay"];
    if (kitchenDelayProactive) {
      evidence.push("recovery.kitchen_delay_proactive");
    }
    if (input.tableTempoPhase === "drinks_finished_estimate" && sommelierEligible) {
      preferred.push("sommelier_refill", "drink_refill");
    }
    return buildResult({
      stage: "waiting_kitchen",
      lane: "service",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.waiting_kitchen"],
      preferredKinds: preferred,
      suppressedKinds: [...GENERIC_UPSELL_KINDS, "scroll_search", "scroll_category", "scroll_bottom"],
    });
  }

  if (
    mental?.mealStage === "dessert_window" ||
    mental?.predictedNeed === "wants_dessert"
  ) {
    return buildResult({
      stage: "dessert",
      lane: "upsell",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.dessert_window"],
      preferredKinds: ["dessert_nudge", "coffee_nudge", "digestif_nudge"],
      suppressedKinds: [
        "browse_nudge",
        "browse_follow_up",
        "popularity_pair",
        "guest_welcome",
        "scroll_search",
        "scroll_category",
      ],
    });
  }

  if (scrollPosture.deferUpsell) {
    evidence.push("lifecycle.defer_generic_upsell");
    suppressedKinds.push(...GENERIC_UPSELL_KINDS);
    preferredKinds.push("scroll_category");
    if (scrollPosture.focusedCategory) {
      evidence.push(`lifecycle.category:${scrollPosture.focusedCategory}`);
    }
    return buildResult({
      stage: "browsing",
      lane: "explore",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence,
      preferredKinds,
      suppressedKinds,
    });
  }

  if (mental?.intent === "ordering" || mental?.intent === "decided") {
    return buildResult({
      stage: "ordering",
      lane: "service",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.ordering"],
      preferredKinds: sommelierEligible ? ["sommelier_pairing", "drink_pairing"] : [],
      suppressedKinds: ["guest_welcome", "browse_nudge"],
    });
  }

  if (scrollPosture.searching || mental?.predictedNeed === "needs_help_choosing") {
    evidence.push("lifecycle.help");
    preferredKinds.push("scroll_search", "browse_nudge");
    suppressedKinds.push(
      "dessert_nudge",
      "happy_hour_upsell",
      "popularity_pair",
      "round_two"
    );
    return buildResult({
      stage: "browsing",
      lane: "help",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence,
      preferredKinds,
      suppressedKinds,
    });
  }

  if (scrollPosture.readyForRecommendation) {
    evidence.push("lifecycle.chef_pick");
    preferredKinds.push("scroll_bottom", "browse_nudge");
    return buildResult({
      stage: "browsing",
      lane: "help",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence,
      preferredKinds,
      suppressedKinds,
    });
  }

  if (input.tableTempoPhase === "browsing_stalled" && input.cartLineCount === 0) {
    evidence.push("lifecycle.tempo_stalled");
    preferredKinds.push("table_tempo_browse", "browse_nudge");
    return buildResult({
      stage: "browsing",
      lane: "help",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence,
      preferredKinds,
      suppressedKinds,
    });
  }

  if (input.tableTempoPhase === "drinks_finished_estimate" && sommelierEligible) {
    evidence.push("lifecycle.sommelier_refill");
    preferredKinds.push("sommelier_refill", "drink_refill");
    return buildResult({
      stage: "waiting_kitchen",
      lane: "upsell",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence,
      preferredKinds,
      suppressedKinds,
    });
  }

  if (input.tableTempoPhase === "post_meal_idle") {
    evidence.push("lifecycle.post_meal");
    preferredKinds.push("bill_prompt", "dessert_nudge", "coffee_nudge");
    return buildResult({
      stage: "post_meal",
      lane: "service",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence,
      preferredKinds,
      suppressedKinds,
    });
  }

  if (
    sommelierEligible &&
    input.cartLineCount > 0 &&
    mental?.mealStage === "pre_order"
  ) {
    preferredKinds.push("sommelier_pairing", "drink_pairing");
    return buildResult({
      stage: "ordering",
      lane: "upsell",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.pairing_window"],
      preferredKinds,
      suppressedKinds,
    });
  }

  if (mental?.predictedNeed === "wants_bill") {
    preferredKinds.push("bill_prompt");
    return buildResult({
      stage: "post_meal",
      lane: "service",
      tempoPhase: input.tableTempoPhase,
      scrollPosture,
      sommelierEligible,
      evidence: [...evidence, "lifecycle.bill"],
      preferredKinds,
      suppressedKinds,
    });
  }

  return buildResult({
    stage: mental?.intent === "arrived" ? "arrival" : "browsing",
    lane: "upsell",
    tempoPhase: input.tableTempoPhase,
    scrollPosture,
    sommelierEligible,
    evidence: evidence.length > 0 ? evidence : ["lifecycle.default"],
    preferredKinds,
    suppressedKinds,
  });
}

const LIFECYCLE_PRIORITY_BOOST = 40;

/** Apply lifecycle lane — suppress + boost preferred proactive kinds. */
export function applyTableLifecycleToCandidates<
  T extends { nudge: { kind: GuestProactiveNudgeKind }; priority: number },
>(input: {
  candidates: T[];
  lifecycle: TableLifecycleOrchestration | null | undefined;
}): T[] {
  const { lifecycle } = input;
  if (!lifecycle) return input.candidates;

  let filtered = input.candidates.filter(
    (row) => !lifecycle.suppressedKinds.includes(row.nudge.kind)
  );

  if (lifecycle.lane === "silence") {
    filtered = filtered.filter((row) =>
      (SERVICE_KINDS as readonly string[]).includes(row.nudge.kind)
    );
    return filtered;
  }

  if (lifecycle.preferredKinds.length === 0) {
    return filtered;
  }

  return filtered.map((row) =>
    lifecycle.preferredKinds.includes(row.nudge.kind)
      ? { ...row, priority: row.priority + LIFECYCLE_PRIORITY_BOOST }
      : row
  );
}
