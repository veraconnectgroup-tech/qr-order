import type { BrowseSequenceEntry } from "@/lib/denis/cognition/offer/offer-types";

export const ABANDONMENT_INTERVENTION_THRESHOLD = 0.6;

export const CART_IDLE_RISK_MS = 3 * 60 * 1000;
export const STOPPED_INTERACTING_MS = 3 * 60 * 1000;
export const PRICE_ABOVE_AVG_RATIO = 1.1;

export type AbandonmentRiskSignal =
  | "cart_idle_3min"
  | "scrolled_past_checkout"
  | "price_above_avg_spend"
  | "item_removed"
  | "add_remove_cycles"
  | "stopped_interacting";

export type AbandonmentRiskScore = {
  /** 0–1 composite abandonment risk. */
  score: number;
  signals: AbandonmentRiskSignal[];
  intervene: boolean;
};

const SIGNAL_WEIGHTS: Record<AbandonmentRiskSignal, number> = {
  cart_idle_3min: 0.2,
  scrolled_past_checkout: 0.15,
  price_above_avg_spend: 0.25,
  item_removed: 0.3,
  add_remove_cycles: 0.4,
  stopped_interacting: 0.2,
};

export type ScoreAbandonmentRiskInput = {
  cartIdleMs: number;
  lastInteractionMs: number;
  viewedCheckout?: boolean;
  scrolledPastCheckout?: boolean;
  cartSubtotalCents: number;
  guestAvgSpendCents?: number | null;
  removedItemCount?: number;
  addRemoveCycleCount?: number;
  itemCount?: number;
};

/** Count add→remove→add (or remove→add→remove) oscillation patterns. */
export function countAddRemoveCycles(
  events: Array<"add" | "remove">
): number {
  let cycles = 0;
  let index = 0;

  while (index <= events.length - 3) {
    const slice = events.slice(index, index + 3);
    const oscillating =
      (slice[0] === "add" && slice[1] === "remove" && slice[2] === "add") ||
      (slice[0] === "remove" && slice[1] === "add" && slice[2] === "remove");

    if (oscillating) {
      cycles += 1;
      index += 3;
      continue;
    }
    index += 1;
  }

  return cycles;
}

export function countAddRemoveCyclesFromSequence(
  sequence: BrowseSequenceEntry[]
): number {
  const events = sequence
    .filter(
      (entry) =>
        entry.action === "add_to_cart" || entry.action === "remove_from_cart"
    )
    .map((entry) =>
      entry.action === "add_to_cart" ? ("add" as const) : ("remove" as const)
    );
  return countAddRemoveCycles(events);
}

/** Real-time abandonment risk — deterministic, no LLM. */
export function scoreAbandonmentRisk(
  input: ScoreAbandonmentRiskInput
): AbandonmentRiskScore {
  const signals: AbandonmentRiskSignal[] = [];

  if (input.itemCount != null && input.itemCount <= 0) {
    return { score: 0, signals: [], intervene: false };
  }

  if (input.cartIdleMs >= CART_IDLE_RISK_MS) {
    signals.push("cart_idle_3min");
  }

  if (input.viewedCheckout || input.scrolledPastCheckout) {
    signals.push("scrolled_past_checkout");
  }

  if (
    input.guestAvgSpendCents != null &&
    input.guestAvgSpendCents > 0 &&
    input.cartSubtotalCents > input.guestAvgSpendCents * PRICE_ABOVE_AVG_RATIO
  ) {
    signals.push("price_above_avg_spend");
  }

  if ((input.removedItemCount ?? 0) > 0) {
    signals.push("item_removed");
  }

  if ((input.addRemoveCycleCount ?? 0) >= 1) {
    signals.push("add_remove_cycles");
  }

  if (input.lastInteractionMs >= STOPPED_INTERACTING_MS) {
    signals.push("stopped_interacting");
  }

  const raw = signals.reduce(
    (sum, signal) => sum + SIGNAL_WEIGHTS[signal],
    0
  );
  const score = Math.min(1, Math.round(raw * 100) / 100);

  return {
    score,
    signals,
    intervene: score > ABANDONMENT_INTERVENTION_THRESHOLD,
  };
}
