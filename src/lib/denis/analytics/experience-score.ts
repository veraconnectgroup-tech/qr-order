export type ExperienceScoreComponents = {
  conversionRate: number;
  avgTurnsToOrder: number;
  firstOrderTimeSeconds: number;
  correctionRate: number;
  repeatedQuestionRate: number;
  completionRate: number;
  returnGuestRate: number;
};

export type ExperienceScore = {
  date: string;
  locationId: string;
  overallScore: number;
  components: ExperienceScoreComponents;
};

export type ExperienceScoreAlert = {
  severity: "warning" | "critical";
  message: string;
  currentScore: number;
  previousScore: number;
  dropPercent: number;
  hint?: string;
};

export type DailyScoreInput = {
  sessionsTotal: number;
  convertedSessions: number;
  abandonedSessions: number;
  cartCorrections: number;
  repeatedQuestions: number;
  totalTurns: number;
  orderTimeSecondsTotal: number;
  returningGuestSessions: number;
};

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(1, Math.max(0, numerator / denominator));
}

export function buildExperienceScoreComponents(
  input: DailyScoreInput
): ExperienceScoreComponents {
  const sessionsTotal = Math.max(input.sessionsTotal, 0);
  const converted = Math.max(input.convertedSessions, 0);

  const conversionRate = safeRate(converted, sessionsTotal);
  const avgTurnsToOrder =
    converted > 0
      ? input.totalTurns / converted
      : sessionsTotal > 0
        ? input.totalTurns / sessionsTotal
        : 0;
  const firstOrderTimeSeconds =
    converted > 0 ? input.orderTimeSecondsTotal / converted : 0;
  const correctionRate = safeRate(input.cartCorrections, sessionsTotal);
  const repeatedQuestionRate = safeRate(input.repeatedQuestions, sessionsTotal);
  const completionRate = safeRate(
    sessionsTotal,
    sessionsTotal + Math.max(input.abandonedSessions, 0)
  );
  const returnGuestRate = safeRate(input.returningGuestSessions, sessionsTotal);

  return {
    conversionRate,
    avgTurnsToOrder,
    firstOrderTimeSeconds,
    correctionRate,
    repeatedQuestionRate,
    completionRate,
    returnGuestRate,
  };
}

/**
 * Automatic experience score — no guest survey required.
 * Weights: conversion 40%, efficiency 25%, accuracy 20%, satisfaction 15%.
 */
export function calculateExperienceScore(
  components: ExperienceScoreComponents
): number {
  const efficiencyScore = Math.min(1, 5 / Math.max(components.avgTurnsToOrder, 0.5));
  const accuracyScore =
    (1 - components.correctionRate) * 0.6 +
    (1 - components.repeatedQuestionRate) * 0.4;
  const satisfactionScore =
    components.completionRate * 0.6 + components.returnGuestRate * 0.4;

  const raw =
    components.conversionRate * 40 +
    efficiencyScore * 25 +
    accuracyScore * 20 +
    satisfactionScore * 15;

  return Math.round(Math.min(100, Math.max(0, raw)) * 10) / 10;
}

export function buildExperienceScore(input: {
  date: string;
  locationId: string;
  daily: DailyScoreInput;
}): ExperienceScore {
  const components = buildExperienceScoreComponents(input.daily);
  return {
    date: input.date,
    locationId: input.locationId,
    overallScore: calculateExperienceScore(components),
    components,
  };
}

export type ExperienceScoreTrendPoint = {
  date: string;
  score: number;
};

export function detectExperienceScoreAlert(
  points: ExperienceScoreTrendPoint[],
  options?: { dropThresholdPercent?: number; windowDays?: number }
): ExperienceScoreAlert | null {
  const dropThreshold = options?.dropThresholdPercent ?? 10;
  const windowDays = options?.windowDays ?? 3;

  if (points.length < windowDays + 1) return null;

  const recent = points.slice(-windowDays);
  const baseline = points.slice(-(windowDays + 3), -windowDays);
  if (baseline.length === 0) return null;

  const currentAvg =
    recent.reduce((sum, row) => sum + row.score, 0) / recent.length;
  const previousAvg =
    baseline.reduce((sum, row) => sum + row.score, 0) / baseline.length;

  if (previousAvg <= 0) return null;

  const dropPercent = ((previousAvg - currentAvg) / previousAvg) * 100;
  if (dropPercent < dropThreshold) return null;

  const latest = recent[recent.length - 1];
  const hint =
    dropPercent >= 15
      ? "Correction rate may be elevated — check menu accuracy and Denis config."
      : undefined;

  return {
    severity: dropPercent >= 20 ? "critical" : "warning",
    message: `Experience Score dropped to ${latest?.score.toFixed(0) ?? currentAvg.toFixed(0)} (was ${previousAvg.toFixed(0)})`,
    currentScore: latest?.score ?? currentAvg,
    previousScore: previousAvg,
    dropPercent,
    hint,
  };
}

export function dailyRowToScoreInput(row: {
  sessions_closed?: number;
  converted_sessions?: number;
  abandoned_sessions?: number;
  cart_corrections?: number;
  repeated_questions?: number;
  total_turns?: number;
  t0_turns?: number;
  llm_turns?: number;
  order_time_seconds_total?: number;
  returning_guest_sessions?: number;
}): DailyScoreInput {
  const totalTurns =
    (row.total_turns ?? 0) > 0
      ? (row.total_turns ?? 0)
      : (row.t0_turns ?? 0) + (row.llm_turns ?? 0);

  return {
    sessionsTotal: row.sessions_closed ?? 0,
    convertedSessions: row.converted_sessions ?? 0,
    abandonedSessions: row.abandoned_sessions ?? 0,
    cartCorrections: row.cart_corrections ?? 0,
    repeatedQuestions: row.repeated_questions ?? 0,
    totalTurns,
    orderTimeSecondsTotal: row.order_time_seconds_total ?? 0,
    returningGuestSessions: row.returning_guest_sessions ?? 0,
  };
}
