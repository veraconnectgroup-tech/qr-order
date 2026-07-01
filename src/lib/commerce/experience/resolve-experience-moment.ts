export type FeedbackSentiment = "positive" | "neutral" | "negative";

export type FeedbackCategory = "food" | "service" | "wait_time" | "other";

export type ExperienceMoment =
  | "checkout_thanks"
  | "feedback_eligible"
  | "none";

export type DenisQualitySignal = "good" | "neutral" | "poor";

export type ExperienceScoreBand = "high" | "mid" | "low";

export type ExperienceBehaviorMode =
  | "celebrate"
  | "gentle"
  | "apology";

export type RealtimeExperienceFactors = {
  /** Minutes from order placed → delivered (latest delivered order). */
  waitMinutes: number | null;
  denisQuality: DenisQualitySignal;
  /** null = not yet known (no accuracy adjustment). */
  orderAccurate: boolean | null;
  proactiveHelpful: boolean;
  /** Waiter calls, explicit frustration signals, repeat complaints. */
  frustrationEvents: number;
};

export type RealtimeExperienceBreakdown = {
  base: number;
  waitDelta: number;
  denisQualityDelta: number;
  orderAccuracyDelta: number;
  proactiveDelta: number;
  frustrationDelta: number;
};

export type RealtimeExperienceResult = {
  score: number;
  band: ExperienceScoreBand;
  behavior: ExperienceBehaviorMode;
  breakdown: RealtimeExperienceBreakdown;
  tippingMode: "aggressive" | "gentle" | "apology";
  reviewMode: "google" | "none" | "internal";
  staffAlert: boolean;
};

export const REALTIME_EXPERIENCE_BASE = 5;
export const EXPERIENCE_HIGH_THRESHOLD = 8;
export const EXPERIENCE_LOW_THRESHOLD = 5;
export const EXPERIENCE_STAFF_ALERT_THRESHOLD = 4;

/** ADR-013/014 — when to prompt for feedback vs thank-only. */
export function resolveExperienceMoment(input: {
  paymentStatus: string;
  orderStatus: string;
  sessionBillSettled: boolean;
  allSessionOrdersDelivered: boolean;
  feedbackAlreadySubmitted?: boolean;
}): ExperienceMoment {
  if (input.feedbackAlreadySubmitted) {
    return "none";
  }

  if (input.paymentStatus !== "paid" && input.paymentStatus !== "pos_online") {
    return "none";
  }

  const mealComplete =
    input.sessionBillSettled ||
    input.orderStatus === "delivered" ||
    input.allSessionOrdersDelivered;

  if (!mealComplete) {
    return "checkout_thanks";
  }

  return "feedback_eligible";
}

export function ratingToSentiment(rating: number): FeedbackSentiment {
  if (rating >= 4) return "positive";
  if (rating === 3) return "neutral";
  return "negative";
}

export function isPaidForExperience(paymentStatus: string): boolean {
  return paymentStatus === "paid" || paymentStatus === "pos_online";
}

function clampExperienceScore(value: number): number {
  return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
}

function waitTimeDelta(waitMinutes: number | null): number {
  if (waitMinutes == null || waitMinutes < 0) return 0;
  if (waitMinutes < 10) return 2;
  if (waitMinutes <= 20) return 0;
  return -2;
}

function denisQualityDelta(quality: DenisQualitySignal): number {
  if (quality === "good") return 1;
  if (quality === "poor") return -1;
  return 0;
}

function orderAccuracyDelta(orderAccurate: boolean | null): number {
  if (orderAccurate === true) return 2;
  if (orderAccurate === false) return -2;
  return 0;
}

export function resolveExperienceScoreBand(score: number): ExperienceScoreBand {
  if (score > EXPERIENCE_HIGH_THRESHOLD) return "high";
  if (score >= EXPERIENCE_LOW_THRESHOLD) return "mid";
  return "low";
}

export function resolveExperienceBehaviorMode(
  score: number
): ExperienceBehaviorMode {
  const band = resolveExperienceScoreBand(score);
  if (band === "high") return "celebrate";
  if (band === "mid") return "gentle";
  return "apology";
}

export function resolveExperienceTippingMode(
  score: number
): RealtimeExperienceResult["tippingMode"] {
  const band = resolveExperienceScoreBand(score);
  if (band === "high") return "aggressive";
  if (band === "mid") return "gentle";
  return "apology";
}

export function resolveExperienceReviewMode(
  score: number
): RealtimeExperienceResult["reviewMode"] {
  if (score > EXPERIENCE_HIGH_THRESHOLD) return "google";
  if (score < EXPERIENCE_LOW_THRESHOLD) return "internal";
  return "none";
}

export function shouldEmitLowExperienceStaffAlert(score: number): boolean {
  return score < EXPERIENCE_STAFF_ALERT_THRESHOLD;
}

export function buildLowExperienceStaffAlertMessage(input: {
  tableName: string;
  score: number;
  language?: string | null;
}): string {
  const lang = (input.language ?? "sr").toLowerCase().slice(0, 2);
  if (lang === "en") {
    return `Table ${input.tableName} has a poor experience (score ${input.score.toFixed(1)}) — please check in.`;
  }
  if (lang === "de") {
    return `Tisch ${input.tableName} — schlechtes Erlebnis (Score ${input.score.toFixed(1)}) — bitte eingreifen!`;
  }
  return `Sto ${input.tableName} ima loše iskustvo (score ${input.score.toFixed(1)}) — interveniši!`;
}

/** Denis narration hint from live experience score (Prompt 78). */
export function resolveExperienceDenisHint(input: {
  score: number;
  language?: string | null;
}): string | null {
  const mode = resolveExperienceBehaviorMode(input.score);
  const lang = (input.language ?? "sr").toLowerCase().slice(0, 2);

  if (mode === "celebrate") {
    if (lang === "en") return "Hope you're enjoying everything! Dessert?";
    if (lang === "de") return "Ich hoffe, es schmeckt! Lust auf Dessert?";
    return "Nadam se da uživate! Desert?";
  }

  if (mode === "apology") {
    if (lang === "en") {
      return "Sorry about the wait — maybe a complimentary dessert?";
    }
    if (lang === "de") {
      return "Entschuldigung für die Wartezeit — vielleicht ein Dessert aufs Haus?";
    }
    return "Žao mi je za čekanje. Možda besplatan desert?";
  }

  return null;
}

/** Real-time per-session experience score (0–10) from additive factors. */
export function computeRealtimeExperienceScore(
  factors: RealtimeExperienceFactors
): RealtimeExperienceResult {
  const waitDelta = waitTimeDelta(factors.waitMinutes);
  const denisDelta = denisQualityDelta(factors.denisQuality);
  const accuracyDelta = orderAccuracyDelta(factors.orderAccurate);
  const proactiveDelta = factors.proactiveHelpful ? 1 : 0;
  const frustrationDelta = -Math.max(0, factors.frustrationEvents);

  const raw =
    REALTIME_EXPERIENCE_BASE +
    waitDelta +
    denisDelta +
    accuracyDelta +
    proactiveDelta +
    frustrationDelta;

  const score = clampExperienceScore(raw);
  const band = resolveExperienceScoreBand(score);

  return {
    score,
    band,
    behavior: resolveExperienceBehaviorMode(score),
    breakdown: {
      base: REALTIME_EXPERIENCE_BASE,
      waitDelta,
      denisQualityDelta: denisDelta,
      orderAccuracyDelta: accuracyDelta,
      proactiveDelta,
      frustrationDelta,
    },
    tippingMode: resolveExperienceTippingMode(score),
    reviewMode: resolveExperienceReviewMode(score),
    staffAlert: shouldEmitLowExperienceStaffAlert(score),
  };
}

export type ExperienceRevenueCorrelationPoint = {
  date: string;
  experienceScore: number;
  revenueCents: number;
};

/** Pearson correlation between daily experience score and revenue (analytics). */
export function correlateExperienceWithRevenue(
  points: ExperienceRevenueCorrelationPoint[]
): number | null {
  const rows = points.filter(
    (row) =>
      Number.isFinite(row.experienceScore) &&
      Number.isFinite(row.revenueCents) &&
      row.revenueCents >= 0
  );
  if (rows.length < 2) return null;

  const n = rows.length;
  const sumX = rows.reduce((sum, row) => sum + row.experienceScore, 0);
  const sumY = rows.reduce((sum, row) => sum + row.revenueCents, 0);
  const sumXY = rows.reduce(
    (sum, row) => sum + row.experienceScore * row.revenueCents,
    0
  );
  const sumX2 = rows.reduce(
    (sum, row) => sum + row.experienceScore * row.experienceScore,
    0
  );
  const sumY2 = rows.reduce(
    (sum, row) => sum + row.revenueCents * row.revenueCents,
    0
  );

  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt(
    (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
  );
  if (denominator === 0) return null;

  return Math.round((numerator / denominator) * 1000) / 1000;
}

export type SessionExperienceDailyRow = {
  date: string;
  score: number;
  revenueCents?: number;
};

export type DailyExperienceAnalytics = {
  date: string;
  averageScore: number;
  sessionCount: number;
  revenueCents: number;
};

/** Aggregate per-session realtime scores into daily averages (analytics). */
export function aggregateDailyExperienceScores(
  rows: SessionExperienceDailyRow[]
): DailyExperienceAnalytics[] {
  const byDate = new Map<
    string,
    { scoreSum: number; count: number; revenueCents: number }
  >();

  for (const row of rows) {
    if (!Number.isFinite(row.score)) continue;
    const bucket = byDate.get(row.date) ?? {
      scoreSum: 0,
      count: 0,
      revenueCents: 0,
    };
    bucket.scoreSum += row.score;
    bucket.count += 1;
    bucket.revenueCents += Math.max(0, row.revenueCents ?? 0);
    byDate.set(row.date, bucket);
  }

  return [...byDate.entries()]
    .map(([date, bucket]) => ({
      date,
      averageScore:
        bucket.count > 0
          ? Math.round((bucket.scoreSum / bucket.count) * 10) / 10
          : 0,
      sessionCount: bucket.count,
      revenueCents: bucket.revenueCents,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type ExperienceScoreTrend = {
  points: Array<{ date: string; averageScore: number }>;
  direction: "up" | "down" | "flat";
  delta: number;
};

/** Simple trend from daily average experience scores. */
export function buildExperienceScoreTrend(
  daily: DailyExperienceAnalytics[],
  windowDays = 3
): ExperienceScoreTrend | null {
  if (daily.length < windowDays * 2) return null;

  const recent = daily.slice(-windowDays);
  const prior = daily.slice(-windowDays * 2, -windowDays);
  const recentAvg =
    recent.reduce((sum, row) => sum + row.averageScore, 0) / recent.length;
  const priorAvg =
    prior.reduce((sum, row) => sum + row.averageScore, 0) / prior.length;
  const delta = Math.round((recentAvg - priorAvg) * 10) / 10;

  return {
    points: daily.map((row) => ({
      date: row.date,
      averageScore: row.averageScore,
    })),
    direction: delta > 0.1 ? "up" : delta < -0.1 ? "down" : "flat",
    delta,
  };
}
