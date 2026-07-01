import type { GuestMentalModel } from "@/lib/denis/cognition/mental-model/mental-model-types";
import {
  DEFAULT_PROACTIVE_POLICY,
  resolveKindPolicy,
} from "@/lib/denis/cognition/proactive/proactive-policy-defaults";
import type { GuestProactiveNudgeKind } from "@/lib/denis/cognition/proactive/proactive-types";

/** Kitchen delay nudges still allowed when guest closed receptiveness. */
export const RECEPTIVENESS_CLOSED_ALLOWED_KINDS: readonly GuestProactiveNudgeKind[] =
  ["order_delay", "order_eta_update", "slow_kitchen"];

const PACE_RUSHED_BLOCKED_KINDS: readonly GuestProactiveNudgeKind[] = [
  "browse_nudge",
  "browse_follow_up",
  "guest_welcome",
  "popularity_pair",
  "cart_recovery",
  "cart_abandonment_prevention",
  "happy_hour_upsell",
];

const BUDGET_AFFINITY_BLOCKED_KINDS: readonly GuestProactiveNudgeKind[] = [
  "popularity_pair",
  "dessert_nudge",
  "happy_hour_upsell",
  "round_two",
  "drink_pairing",
  "drink_refill",
  "drink_with_food",
];

export function isServiceProactiveKind(kind: GuestProactiveNudgeKind): boolean {
  return !resolveKindPolicy(DEFAULT_PROACTIVE_POLICY, kind).upsell;
}

export function isReceptivenessClosed(mental: GuestMentalModel): boolean {
  return mental.decline.hardClosed || mental.receptiveness === "closed";
}

export function formatGuestMentalModelBlock(
  mental: GuestMentalModel | null | undefined
): string {
  if (!mental) return "";

  const lines = [
    "GUEST MENTAL MODEL:",
    `- receptiveness: ${mental.receptiveness}`,
    `- pace: ${mental.pace}`,
    `- price_affinity: ${mental.priceAffinity}`,
    `- nudge_budget: ${mental.nudgeBudget.remaining}/${mental.nudgeBudget.max}`,
    `- predicted_need: ${mental.predictedNeed}`,
    `- meal_stage: ${mental.mealStage}`,
  ];

  if (isReceptivenessClosed(mental)) {
    lines.push(
      "- instruction: closed → no proactive upsell; kitchen delay updates only"
    );
  }
  if (mental.pace === "rushed") {
    lines.push(
      "- instruction: RUSHED → short replies; no small talk or leisurely suggestions"
    );
  }
  if (mental.priceAffinity === "budget") {
    lines.push(
      "- instruction: budget → prefer value options; never lead with most expensive items"
    );
  }
  if (mental.nudgeBudget.remaining <= 0) {
    lines.push(
      "- instruction: nudge_budget=0 → service messages only; no upsell nudges"
    );
  }

  const predictions = mental.predictions;
  if (predictions?.nextAction.probability >= 0.65) {
    lines.push(
      `- prediction_next: ${predictions.nextAction.action} (${Math.round(predictions.nextAction.probability * 100)}%)`
    );
    if (predictions.nextAction.preloadProducts.length > 0) {
      lines.push(
        `- preload_context: ${predictions.nextAction.preloadProducts.map((p) => p.productName).join(", ")}`
      );
    }
  }
  if (predictions?.duration.mode === "efficient") {
    lines.push("- instruction: predicted quick visit → efficient, fast replies");
  }
  if (predictions?.duration.mode === "relaxed") {
    lines.push("- instruction: predicted long visit → relaxed pacing, storytelling ok");
  }
  if (predictions?.spend.upsellTier === "value") {
    lines.push("- instruction: predicted low spend → value items only");
  }
  if (predictions?.spend.upsellTier === "premium") {
    lines.push("- instruction: predicted high spend → premium upsell ok");
  }

  return lines.join("\n");
}

export function filterProactiveCandidatesByMentalModel<
  T extends { nudge: { kind: GuestProactiveNudgeKind } },
>(input: {
  candidates: T[];
  mental: GuestMentalModel | null | undefined;
  enforce: boolean;
}): T[] {
  const { mental, enforce } = input;
  if (!enforce || !mental) return input.candidates;

  let filtered = input.candidates;

  if (isReceptivenessClosed(mental)) {
    return filtered.filter((row) =>
      RECEPTIVENESS_CLOSED_ALLOWED_KINDS.includes(row.nudge.kind)
    );
  }

  if (mental.nudgeBudget.remaining <= 0) {
    filtered = filtered.filter((row) => isServiceProactiveKind(row.nudge.kind));
  }

  if (mental.priceAffinity === "budget") {
    filtered = filtered.filter(
      (row) => !BUDGET_AFFINITY_BLOCKED_KINDS.includes(row.nudge.kind)
    );
  }

  const upsellTier = mental.predictions?.spend.upsellTier;
  if (upsellTier === "value") {
    filtered = filtered.filter(
      (row) => !BUDGET_AFFINITY_BLOCKED_KINDS.includes(row.nudge.kind)
    );
  }

  if (mental.pace === "rushed") {
    filtered = filtered.filter(
      (row) =>
        !PACE_RUSHED_BLOCKED_KINDS.includes(row.nudge.kind) ||
        (row.nudge.kind === "browse_nudge" &&
          mental.predictedNeed === "needs_help_choosing")
    );
  }

  return filtered;
}

export function mentalModelBlocksProactiveKind(input: {
  mental: GuestMentalModel | null | undefined;
  kind: GuestProactiveNudgeKind;
  enforce: boolean;
}): { blocked: boolean; reason: string | null } {
  const { mental, kind, enforce } = input;
  if (!enforce || !mental) {
    return { blocked: false, reason: null };
  }

  if (
    isReceptivenessClosed(mental) &&
    !RECEPTIVENESS_CLOSED_ALLOWED_KINDS.includes(kind)
  ) {
    return { blocked: true, reason: "gmm.receptiveness_closed" };
  }

  if (mental.nudgeBudget.remaining <= 0 && !isServiceProactiveKind(kind)) {
    return { blocked: true, reason: "gmm.nudge_budget_zero" };
  }

  if (mental.priceAffinity === "budget" && BUDGET_AFFINITY_BLOCKED_KINDS.includes(kind)) {
    return { blocked: true, reason: "gmm.price_affinity_mismatch" };
  }

  if (
    mental.predictions?.spend.upsellTier === "value" &&
    BUDGET_AFFINITY_BLOCKED_KINDS.includes(kind)
  ) {
    return { blocked: true, reason: "gmm.predicted_spend_low" };
  }

  if (mental.pace === "rushed" && PACE_RUSHED_BLOCKED_KINDS.includes(kind)) {
    return { blocked: true, reason: "gmm.pace_rushed" };
  }

  return { blocked: false, reason: null };
}
