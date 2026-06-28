import type { AiGuestOrder } from "@/lib/ai/order-context";
import type {
  LocationRhythmPriorsJson,
  RhythmSlotPrior,
  RhythmSlotStress,
} from "@/lib/denis/config/rhythm-prior-types";

export type RevenueStrategy = "turnover" | "check_size" | "balanced";

/** Session check tier for per-table revenue posture (H2). */
export type CheckTier = "low_check" | "normal" | "high_check";

export const LOW_CHECK_THRESHOLD_EUROS = 12;
export const HIGH_CHECK_THRESHOLD_EUROS = 50;

export type RevenueInsight = {
  /** Revenue per available seat per hour (learned slot). */
  currentSlotRevPASH: number | null;
  /** Best-performing slot revPASH with enough samples. */
  targetRevPASH: number | null;
  strategy: RevenueStrategy;
  optimalDessertTimingMinutes: number | null;
  avgCheckCurrentSlot: number | null;
};

const DEFAULT_MIN_SAMPLE_SESSIONS = 8;
const TURNOVER_REV_PASH_RATIO = 0.9;
const CHECK_SIZE_REV_PASH_RATIO = 0.75;

function slotRevPASH(
  slot: RhythmSlotPrior,
  seatCount: number
): number | null {
  if (
    seatCount <= 0 ||
    slot.revenueEma == null ||
    !Number.isFinite(slot.revenueEma) ||
    slot.sessionDurationP50Min == null ||
    slot.sessionDurationP50Min <= 0
  ) {
    return null;
  }

  return (
    Math.round(
      ((slot.revenueEma * 60) / (seatCount * slot.sessionDurationP50Min)) * 100
    ) / 100
  );
}

function bestTargetRevPASH(
  priors: LocationRhythmPriorsJson,
  seatCount: number,
  minSampleSessions: number
): { target: number | null; bestSlotKey: string | null } {
  let target: number | null = null;
  let bestSlotKey: string | null = null;

  for (const [slotKey, slot] of Object.entries(priors.slots)) {
    if (slot.sampleSessions < minSampleSessions) continue;
    const rev = slotRevPASH(slot, seatCount);
    if (rev == null) continue;
    if (target == null || rev > target) {
      target = rev;
      bestSlotKey = slotKey;
    }
  }

  return { target, bestSlotKey };
}

function deriveStrategy(input: {
  currentRevPASH: number | null;
  targetRevPASH: number | null;
  currentSlotStress?: RhythmSlotStress;
}): RevenueStrategy {
  if (input.currentSlotStress === "rush") {
    return "turnover";
  }

  if (
    input.currentRevPASH != null &&
    input.targetRevPASH != null &&
    input.targetRevPASH > 0
  ) {
    const ratio = input.currentRevPASH / input.targetRevPASH;
    if (ratio >= TURNOVER_REV_PASH_RATIO) {
      return "turnover";
    }
    if (ratio < CHECK_SIZE_REV_PASH_RATIO) {
      return "check_size";
    }
  }

  return "balanced";
}

function optimalDessertMinutes(
  priors: LocationRhythmPriorsJson,
  currentSlotKey: string,
  bestSlotKey: string | null
): number | null {
  const current = priors.slots[currentSlotKey]?.dessertDelayP50Min;
  if (current != null && Number.isFinite(current) && current > 0) {
    return Math.round(current);
  }

  if (bestSlotKey) {
    const best = priors.slots[bestSlotKey]?.dessertDelayP50Min;
    if (best != null && Number.isFinite(best) && best > 0) {
      return Math.round(best);
    }
  }

  return null;
}

/** H2 — revPASH + strategy from learned rhythm priors (owner-facing, not guest copy). */
export function computeRevenueInsight(
  priors: LocationRhythmPriorsJson,
  currentSlot: string,
  seatCount: number,
  options?: {
    minSampleSessions?: number;
    currentSlotStress?: RhythmSlotStress;
  }
): RevenueInsight {
  const minSampleSessions =
    options?.minSampleSessions ?? DEFAULT_MIN_SAMPLE_SESSIONS;
  const seats = Math.max(1, seatCount);
  const currentSlotPrior = priors.slots[currentSlot];
  const { target: targetRevPASH, bestSlotKey } = bestTargetRevPASH(
    priors,
    seats,
    minSampleSessions
  );

  const currentSlotRevPASH =
    currentSlotPrior && currentSlotPrior.sampleSessions >= minSampleSessions
      ? slotRevPASH(currentSlotPrior, seats)
      : null;

  const strategy = deriveStrategy({
    currentRevPASH: currentSlotRevPASH,
    targetRevPASH,
    currentSlotStress: options?.currentSlotStress,
  });

  return {
    currentSlotRevPASH,
    targetRevPASH,
    strategy,
    optimalDessertTimingMinutes: optimalDessertMinutes(
      priors,
      currentSlot,
      bestSlotKey
    ),
    avgCheckCurrentSlot:
      currentSlotPrior?.revenueEma != null &&
      Number.isFinite(currentSlotPrior.revenueEma)
        ? Math.round(currentSlotPrior.revenueEma * 100) / 100
        : null,
  };
}

export function formatRevenueInsightEvidence(
  insight: RevenueInsight | null | undefined
): string {
  if (!insight) return "";

  const lines = ["REVENUE INSIGHT:"];

  if (insight.currentSlotRevPASH != null) {
    const targetPart =
      insight.targetRevPASH != null
        ? ` (target: ${insight.targetRevPASH})`
        : "";
    lines.push(
      `- RevPASH current slot: ${insight.currentSlotRevPASH}/seat/hr${targetPart}`
    );
  }

  const strategyLabel =
    insight.strategy === "turnover"
      ? "turnover (rush — prioritize table turns)"
      : insight.strategy === "check_size"
        ? "check_size (slow period — focus on upsell)"
        : "balanced (standard upsell timing)";

  lines.push(`- Strategy: ${strategyLabel}`);

  if (insight.optimalDessertTimingMinutes != null) {
    lines.push(
      `- Optimal dessert timing: ${insight.optimalDessertTimingMinutes} min after main delivered`
    );
  }

  if (insight.avgCheckCurrentSlot != null) {
    lines.push(`- Avg check this slot: ${insight.avgCheckCurrentSlot}`);
  }

  return lines.length > 1 ? lines.join("\n") : "";
}

/** Staff copilot venue headline — not shown to guests. */
export function staffCopilotRevenueHint(
  insight: RevenueInsight | null | undefined
): string | null {
  if (!insight) return null;
  if (insight.strategy === "check_size") {
    return "Slow period — fokus na upsell";
  }
  if (insight.strategy === "turnover") {
    return "Rush period — brži turnover";
  }
  return null;
}

/** Proactive priority delta by strategy (H2). */
export function revenueStrategyPriorityBoost(
  kind:
    | "dessert_nudge"
    | "bill_prompt"
    | "popularity_pair"
    | "drink_pairing",
  strategy: RevenueStrategy | null | undefined
): number {
  if (!strategy || strategy === "balanced") return 0;

  if (strategy === "turnover") {
    if (kind === "bill_prompt") return 120;
    if (kind === "dessert_nudge") return -500;
    if (kind === "popularity_pair") return -80;
    return 0;
  }

  if (strategy === "check_size") {
    if (kind === "dessert_nudge") return 90;
    if (kind === "popularity_pair") return 70;
    if (kind === "drink_pairing") return 50;
    return 0;
  }

  return 0;
}

export function shouldSkipDessertForRevenueStrategy(
  strategy: RevenueStrategy | null | undefined
): boolean {
  return strategy === "turnover";
}

export function deriveCheckTier(sessionTotalEuros: number): CheckTier {
  const total = Math.max(0, sessionTotalEuros);
  if (total >= HIGH_CHECK_THRESHOLD_EUROS) return "high_check";
  if (total < LOW_CHECK_THRESHOLD_EUROS) return "low_check";
  return "normal";
}

/** Sum submitted order line snapshots for the active session (EUR). */
export function computeSessionCheckEuros(orders: AiGuestOrder[]): number {
  let total = 0;
  for (const order of orders) {
    for (const item of order.order_items) {
      total += Number(item.unit_price) * Number(item.quantity);
    }
  }
  return Math.round(total * 100) / 100;
}

export function shouldOfferFoodUpsellForRevenue(
  strategy: RevenueStrategy | null | undefined,
  checkTier: CheckTier
): boolean {
  return strategy === "check_size" && checkTier === "low_check";
}

/** High-check tables — suppress upsell unless guest mood is open (digestif/dessert only). */
export function shouldSuppressUpsellForHighCheck(
  checkTier: CheckTier,
  receptiveness: string | null | undefined
): boolean {
  return checkTier === "high_check" && receptiveness !== "open";
}

export function revenueCheckTierPriorityBoost(
  kind:
    | "dessert_nudge"
    | "bill_prompt"
    | "popularity_pair"
    | "drink_pairing"
    | "drink_with_food"
    | "browse_nudge",
  strategy: RevenueStrategy | null | undefined,
  checkTier: CheckTier
): number {
  if (shouldOfferFoodUpsellForRevenue(strategy, checkTier)) {
    if (kind === "popularity_pair") return 110;
    if (kind === "drink_with_food") return 100;
    if (kind === "browse_nudge") return 85;
    if (kind === "drink_pairing") return 40;
  }
  return 0;
}

function formatCheckEuros(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Per-table staff copilot hint (M15 revenue intelligence). */
export function staffCopilotTableRevenueHint(input: {
  tableName: string;
  checkTier: CheckTier;
  checkEuros: number;
}): string | null {
  const label = input.tableName.trim() || "—";
  if (input.checkTier === "low_check") {
    return `Sto ${label} ima nizak račun (€${formatCheckEuros(input.checkEuros)}) — Denis predlaže food upsell`;
  }
  if (input.checkTier === "high_check") {
    return `Sto ${label} je već na €${formatCheckEuros(input.checkEuros)} — možda digestiv?`;
  }
  return null;
}
