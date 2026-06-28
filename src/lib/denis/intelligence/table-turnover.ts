import type { SessionTrajectory } from "@/lib/denis/cognition/intervention/fold-session-trajectory";
import type { OrderFact } from "@/lib/denis/loop/types";

export type TableTurnoverPrediction = {
  tableId: string;
  tableName: string;
  currentDurationMin: number;
  estimatedRemainingMin: number;
  confidence: number;
  mealStage: SessionTrajectory["meal"];
  signals: string[];
};

export type RushModeDetection = {
  isRush: boolean;
  reason: string;
  suggestNormal: boolean;
  normalReason: string | null;
};

const DEFAULT_VENUE_TURNOVER_MIN = 75;
const EWMA_ALPHA = 0.35;

/** EWMA of completed session durations for a table (M2). */
export function ewmaTurnoverMinutes(
  historicalDurationsMin: number[],
  fallbackMinutes: number = DEFAULT_VENUE_TURNOVER_MIN
): number {
  if (historicalDurationsMin.length === 0) return fallbackMinutes;

  let value = historicalDurationsMin[0]!;
  for (let i = 1; i < historicalDurationsMin.length; i += 1) {
    value = EWMA_ALPHA * historicalDurationsMin[i]! + (1 - EWMA_ALPHA) * value;
  }
  return Math.round(value);
}

/** Approximate session trajectory from floor snapshot — avoids per-table full fold. */
export function deriveTrajectoryFromFloor(input: {
  seatedMinutes: number | null;
  openOrderCount: number;
  allOrdersDelivered: boolean;
  idleMinutes: number | null;
  guestWaitMinutes: number | null;
  minutesSinceLastDelivery: number | null;
}): SessionTrajectory {
  const idle = input.idleMinutes ?? 0;
  const sinceDelivery = input.minutesSinceLastDelivery ?? 0;
  const hasOrders =
    input.openOrderCount > 0 ||
    input.allOrdersDelivered ||
    (input.guestWaitMinutes ?? 0) > 0;

  let meal: SessionTrajectory["meal"] = "pre";
  if (!hasOrders) {
    meal = "pre";
  } else if (input.openOrderCount > 0 || (input.guestWaitMinutes ?? 0) > 0) {
    meal = "active";
  } else if (input.allOrdersDelivered && sinceDelivery >= 30) {
    meal = "paying";
  } else if (input.allOrdersDelivered && sinceDelivery >= 5) {
    meal = "post";
  } else {
    meal = "active";
  }

  let engagement: SessionTrajectory["engagement"] = "warm";
  if (idle >= 20) engagement = "cold";
  else if (idle >= 8) engagement = "lull";
  else if ((input.guestWaitMinutes ?? 0) >= 12) engagement = "lull";

  return {
    ordering: hasOrders ? "steady" : "stuck",
    engagement,
    meal,
    interruptionRisk: 0,
    opportunity: 0.2,
    evidence: [],
  };
}

export function predictTableTurnover(input: {
  tableId: string;
  tableName: string;
  trajectory: SessionTrajectory;
  sessionStartedAt: string;
  ordersFacts: OrderFact[];
  historicalAvgMinutes: number;
  now: number;
}): TableTurnoverPrediction | null {
  const elapsedMin = Math.max(
    0,
    Math.round((input.now - Date.parse(input.sessionStartedAt)) / 60_000)
  );
  const avg = Math.max(20, input.historicalAvgMinutes);
  const signals: string[] = [];
  let remaining = ewmaRemainingMinutes(avg, elapsedMin);
  let confidence = 0.55;

  const preparing = input.ordersFacts.filter((order) =>
    ["pending", "accepted", "preparing", "ready"].includes(order.status)
  );
  const prepTime = Math.max(
    0,
    ...preparing.map((order) => order.estimatedPrepMinutes ?? 0)
  );

  if (input.trajectory.meal === "pre" && preparing.length === 0) {
    remaining = Math.round(avg * 0.9);
    signals.push("pre_meal_no_orders");
    confidence = 0.5;
  } else if (input.trajectory.meal === "active" && preparing.length > 0) {
    remaining = Math.max(5, avg - elapsedMin + prepTime);
    signals.push("active_preparing");
    confidence = 0.72;
  } else if (input.trajectory.meal === "post") {
    remaining = 5;
    signals.push("post_idle");
    confidence = 0.78;
  }

  if (input.trajectory.meal === "paying") {
    remaining = 2;
    signals.push("paying");
    confidence = 0.85;
  }

  if (input.trajectory.engagement === "cold" && input.trajectory.meal === "post") {
    remaining = 3;
    signals.push("cold_post_wrap");
    confidence = 0.8;
  }

  if (input.trajectory.meal === "post" && elapsedMin >= 45) {
    remaining = Math.max(remaining, 8);
    signals.push("long_post_meal");
    confidence = 0.65;
  }

  remaining = Math.max(1, Math.round(remaining));
  signals.push("ewma_baseline");

  return {
    tableId: input.tableId,
    tableName: input.tableName,
    currentDurationMin: elapsedMin,
    estimatedRemainingMin: remaining,
    confidence: Math.min(0.95, confidence),
    mealStage: input.trajectory.meal,
    signals,
  };
}

/** EWMA baseline remaining minutes — avg session minus elapsed. */
export function ewmaRemainingMinutes(
  historicalAvgMinutes: number,
  elapsedMinutes: number
): number {
  const avg = Math.max(20, historicalAvgMinutes);
  const elapsed = Math.max(0, elapsedMinutes);
  return Math.max(1, Math.round(avg - elapsed));
}

/** Rush + long sitting → subtle bill nudge (Prompt 50). */
export function shouldSuggestBillForTurnover(input: {
  prediction: TableTurnoverPrediction;
  isRush: boolean;
}): boolean {
  if (!input.isRush) return false;

  if (turnoverDisplayStatus(input.prediction) === "long_sitting") {
    return true;
  }

  return (
    (input.prediction.mealStage === "post" ||
      input.prediction.mealStage === "paying") &&
    input.prediction.estimatedRemainingMin <= 10
  );
}

export function formatTurnoverRemainingHint(
  prediction: TableTurnoverPrediction,
  tableLabel?: string
): string {
  const name = tableLabel ?? prediction.tableName;
  return `${name} prosečno ${prediction.currentDurationMin + prediction.estimatedRemainingMin} min, sad ${prediction.currentDurationMin} min — verovatno još ~${prediction.estimatedRemainingMin} min.`;
}

/** Occupancy + wait heuristics for rush mode (M2). */
export function detectRushMode(input: {
  activeTableCount: number;
  totalTables: number;
  avgWaitMinutes: number;
  kdsBacklog: number;
}): RushModeDetection {
  if (input.totalTables <= 0) {
    return {
      isRush: false,
      reason: "No tables configured",
      suggestNormal: false,
      normalReason: null,
    };
  }

  const occupancy = input.activeTableCount / input.totalTables;
  const highOccupancy = occupancy > 0.85;
  const longWait = input.avgWaitMinutes > 12;
  const backlogPressure = input.kdsBacklog >= 8;

  const isRush = highOccupancy && (longWait || backlogPressure);

  let reason = "Normal occupancy";
  if (isRush) {
    const parts = [
      `${input.activeTableCount}/${input.totalTables} stolova zauzeto (${Math.round(occupancy * 100)}%)`,
    ];
    if (longWait) parts.push(`prosječno čekanje ${input.avgWaitMinutes} min`);
    if (backlogPressure) parts.push(`KDS backlog ${input.kdsBacklog}`);
    reason = parts.join(" · ");
  }

  const suggestNormal = occupancy < 0.7;
  const normalReason = suggestNormal
    ? `Zauzetost pala na ${Math.round(occupancy * 100)}% — može nazad na normal`
    : null;

  return {
    isRush,
    reason,
    suggestNormal,
    normalReason,
  };
}

export type TurnoverDisplayStatus = "ready_soon" | "in_progress" | "long_sitting";

export function turnoverDisplayStatus(
  prediction: TableTurnoverPrediction
): TurnoverDisplayStatus {
  if (prediction.mealStage === "paying" || prediction.estimatedRemainingMin <= 5) {
    return "ready_soon";
  }
  if (prediction.currentDurationMin >= 45 && prediction.mealStage === "post") {
    return "long_sitting";
  }
  return "in_progress";
}

export function turnoverStatusLabel(status: TurnoverDisplayStatus): string {
  switch (status) {
    case "ready_soon":
      return "Gotov uskoro";
    case "long_sitting":
      return "Dugo sjede";
    default:
      return "U toku";
  }
}

export function turnoverStatusEmoji(status: TurnoverDisplayStatus): string {
  switch (status) {
    case "ready_soon":
      return "🟢";
    case "long_sitting":
      return "🔴";
    default:
      return "🟡";
  }
}

export function formatTurnoverCopilotLine(
  prediction: TableTurnoverPrediction
): string {
  const status = turnoverDisplayStatus(prediction);
  const emoji = turnoverStatusEmoji(status);
  const label = turnoverStatusLabel(status);

  if (status === "ready_soon") {
    return `${emoji} ${prediction.tableName}: ${label} za ~${prediction.estimatedRemainingMin} min`;
  }
  if (status === "long_sitting") {
    return `${emoji} ${prediction.tableName}: ${label} (${prediction.currentDurationMin} min, post-meal idle)`;
  }
  return `${emoji} ${prediction.tableName}: Još ~${prediction.estimatedRemainingMin} min (${label.toLowerCase()})`;
}
