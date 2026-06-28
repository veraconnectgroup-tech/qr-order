import type {
  FeedbackCategory,
  FeedbackSentiment,
} from "@/lib/commerce/experience/resolve-experience-moment";
import type { TrainingInsight } from "@/lib/admin/staff-training-insights";
import { ratingToSentiment } from "@/lib/commerce/experience/resolve-experience-moment";

export type FeedbackRow = {
  rating: number;
  sentiment: FeedbackSentiment;
  category: FeedbackCategory | null;
  createdAt: string;
  comment?: string | null;
};

export type FeedbackTag =
  | "slow_kitchen"
  | "cold_food"
  | "great_service"
  | "slow_service"
  | "long_wait"
  | "price_concern"
  | "portion_size";

export type FeedbackCommentAnalysis = {
  sentiment: FeedbackSentiment;
  category: FeedbackCategory;
  tags: FeedbackTag[];
  dishMention: string | null;
};

export type FeedbackPostSubmitFlow =
  | { kind: "google_review"; message: string }
  | { kind: "denis_followup"; message: string }
  | { kind: "thanks_only"; message: string };

export type DishRecommendationPolicy = "suppress" | "promote" | "neutral";

export const DISH_SUPPRESS_RATING_THRESHOLD = 3.5;
export const DISH_PROMOTE_RATING_THRESHOLD = 4.5;
export const SLOW_SERVICE_TRAINING_THRESHOLD = 3;
export const FEEDBACK_TREND_MIN_NEGATIVE = 5;
export const FEEDBACK_DELAY_MS = 10 * 60_000;

export type FeedbackInsight = {
  recentNegativeRate: number;
  topComplaintCategory: string | null;
  trendDirection: "improving" | "stable" | "declining";
  actionRequired: boolean;
  suggestedFix: string | null;
  positiveRate: number;
  priorPositiveRate: number | null;
  negativeCount: number;
  totalCount: number;
  waitTimeNegativeShare: number;
  topComplaintCount: number;
};

const CATEGORY_FIX: Record<FeedbackCategory, string> = {
  wait_time:
    "Dodaj prep time po stavci za realnije ETA i raniju komunikaciju s gostom.",
  food: "Proveri kvalitet i temperature jela u peak satima — feedback ukazuje na hranu.",
  service: "Fokus na konobarski obilazak i proaktivnu komunikaciju za stolom.",
  other: "Pregledaj komentare u feedback inbox-u i odgovori na otvorene stavke.",
};

function parseTime(iso: string): number {
  return new Date(iso).getTime();
}

function inWindow(
  row: FeedbackRow,
  startMs: number,
  endMs: number
): boolean {
  const t = parseTime(row.createdAt);
  return t >= startMs && t <= endMs;
}

function countByCategory(
  rows: FeedbackRow[],
  sentiment: FeedbackSentiment
): Map<FeedbackCategory, number> {
  const counts = new Map<FeedbackCategory, number>();
  for (const row of rows) {
    if (row.sentiment !== sentiment) continue;
    const category = row.category ?? "other";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return counts;
}

function topCategory(counts: Map<FeedbackCategory, number>): FeedbackCategory | null {
  let best: FeedbackCategory | null = null;
  let bestCount = 0;
  for (const [category, count] of counts) {
    if (count > bestCount) {
      best = category;
      bestCount = count;
    }
  }
  return best;
}

function positiveRate(rows: FeedbackRow[]): number {
  if (rows.length === 0) return 0;
  const positives = rows.filter((row) => row.sentiment === "positive").length;
  return positives / rows.length;
}

function trendDirection(
  currentPositiveRate: number,
  priorPositiveRate: number | null
): FeedbackInsight["trendDirection"] {
  if (priorPositiveRate == null) return "stable";
  const delta = currentPositiveRate - priorPositiveRate;
  if (delta >= 0.05) return "improving";
  if (delta <= -0.05) return "declining";
  return "stable";
}

/** Aggregate guest feedback trends for owner digest + staff copilot (Layer 3 I2). */
export function analyzeFeedbackTrends(
  feedbacks: FeedbackRow[],
  lookbackDays: number,
  nowMs: number = Date.now()
): FeedbackInsight {
  const windowMs = lookbackDays * 86_400_000;
  const currentStart = nowMs - windowMs;
  const priorStart = currentStart - windowMs;

  const current = feedbacks.filter((row) =>
    inWindow(row, currentStart, nowMs)
  );
  const prior = feedbacks.filter((row) =>
    inWindow(row, priorStart, currentStart)
  );

  const totalCount = current.length;
  const negativeRows = current.filter((row) => row.sentiment === "negative");
  const negativeCount = negativeRows.length;
  const recentNegativeRate =
    totalCount === 0 ? 0 : negativeCount / totalCount;

  const negativeByCategory = countByCategory(current, "negative");
  const topComplaint = topCategory(negativeByCategory);

  const waitTimeNegatives = negativeByCategory.get("wait_time") ?? 0;
  const waitTimeNegativeShare =
    negativeCount === 0 ? 0 : waitTimeNegatives / negativeCount;

  const currentPositiveRate = positiveRate(current);
  const priorPositiveRate =
    prior.length > 0 ? positiveRate(prior) : null;

  const direction = trendDirection(currentPositiveRate, priorPositiveRate);

  const actionRequired =
    totalCount >= 3 &&
    (recentNegativeRate >= 0.3 ||
      (topComplaint === "wait_time" && waitTimeNegativeShare >= 0.3));

  const suggestedFix =
    actionRequired && topComplaint ? CATEGORY_FIX[topComplaint] : null;

  return {
    recentNegativeRate,
    topComplaintCategory: topComplaint,
    trendDirection: direction,
    actionRequired,
    suggestedFix,
    positiveRate: currentPositiveRate,
    priorPositiveRate,
    negativeCount,
    totalCount,
    waitTimeNegativeShare,
    topComplaintCount: topComplaint
      ? (negativeByCategory.get(topComplaint) ?? 0)
      : 0,
  };
}

export function staffCopilotFeedbackHint(
  insight: FeedbackInsight
): string | null {
  if (insight.totalCount < 3) return null;
  if (
    insight.topComplaintCategory === "wait_time" &&
    insight.recentNegativeRate >= 0.3
  ) {
    return "Česti prigovori na čekanje — fokus na komunikaciju i ETA";
  }
  if (insight.actionRequired && insight.topComplaintCategory) {
    return `Feedback trend: ${insight.topComplaintCategory} — proveri operativu`;
  }
  return null;
}

const TAG_PATTERNS: Array<{ tag: FeedbackTag; patterns: RegExp[] }> = [
  {
    tag: "slow_kitchen",
    patterns: [/spor[ao]\s*(iz\s*)?kuh/i, /slow\s*kitchen/i, /kitchen\s*slow/i, /kuhinja\s*spor/i],
  },
  {
    tag: "cold_food",
    patterns: [/hladn[ao]/i, /cold\s*food/i, /studi?o/i, /lukewarm/i],
  },
  {
    tag: "great_service",
    patterns: [/odličn[ao]\s*uslug/i, /great\s*service/i, /super\s*service/i, /konobar/i],
  },
  {
    tag: "slow_service",
    patterns: [/spor[ao]\s*uslug/i, /slow\s*service/i, /čekali\s*konobar/i, /waiter\s*slow/i],
  },
  {
    tag: "long_wait",
    patterns: [/predugo\s*ček/, /long\s*wait/i, /čekali\s*predugo/i, /wait\s*time/i],
  },
  {
    tag: "price_concern",
    patterns: [/preskup/i, /too\s*expensive/i, /cijena/i, /price/i],
  },
  {
    tag: "portion_size",
    patterns: [/mala\s*porcij/i, /small\s*portion/i, /premalo/i],
  },
];

const CATEGORY_PATTERNS: Array<{ category: FeedbackCategory; patterns: RegExp[] }> = [
  { category: "wait_time", patterns: [/ček/i, /wait/i, /spor/i, /slow/i, /kuh/i, /kitchen/i] },
  { category: "food", patterns: [/jelo/i, /hrana/i, /food/i, /ukus/i, /taste/i, /schnitzel/i, /pizza/i] },
  { category: "service", patterns: [/uslug/i, /service/i, /konobar/i, /waiter/i, /staff/i] },
];

function normalizeComment(comment: string | null | undefined): string {
  return (comment ?? "").trim().toLowerCase();
}

function extractDishMention(comment: string): string | null {
  const match = comment.match(
    /\b(schnitzel|pizza|burger|pasta|steak|salad|sup[a]|rižoto|tiramisu)\b/i
  );
  return match ? match[1]! : null;
}

/** Rule-based comment analysis — deterministic for tests; LLM can enrich async later. */
export function analyzeFeedbackComment(input: {
  rating: number;
  comment?: string | null;
  sentiment?: FeedbackSentiment | null;
}): FeedbackCommentAnalysis {
  const comment = normalizeComment(input.comment);
  const sentiment = input.sentiment ?? ratingToSentiment(input.rating);

  const tags = new Set<FeedbackTag>();
  for (const row of TAG_PATTERNS) {
    if (row.patterns.some((pattern) => pattern.test(comment))) {
      tags.add(row.tag);
    }
  }

  if (input.rating >= 4 && sentiment === "positive" && tags.size === 0) {
    tags.add("great_service");
  }
  if (input.rating <= 2 && !tags.has("slow_service") && /spor|slow|ček|wait/.test(comment)) {
    tags.add("slow_service");
  }

  let category: FeedbackCategory = "other";
  for (const row of CATEGORY_PATTERNS) {
    if (row.patterns.some((pattern) => pattern.test(comment))) {
      category = row.category;
      break;
    }
  }
  if (category === "other" && tags.has("slow_kitchen")) category = "wait_time";
  if (category === "other" && tags.has("slow_service")) category = "service";
  if (category === "other" && tags.has("cold_food")) category = "food";
  if (category === "other" && sentiment === "positive" && input.rating >= 4) {
    category = "food";
  }

  return {
    sentiment,
    category,
    tags: [...tags],
    dishMention: comment ? extractDishMention(comment) : null,
  };
}

export function formatFeedbackTags(tags: FeedbackTag[]): string[] {
  return tags.map((tag) => `#${tag}`);
}

/** Post-submit routing: high rating → Google review; low → Denis follow-up. */
export function resolveFeedbackPostSubmit(input: {
  rating: number;
  sentiment: FeedbackSentiment;
  language?: string | null;
}): FeedbackPostSubmitFlow {
  const en = input.language === "en";

  if (input.rating >= 4 && input.sentiment === "positive") {
    return {
      kind: "google_review",
      message: en
        ? "We're glad you enjoyed it! If you have 30 seconds, a Google review would mean a lot to us 💛"
        : "Drago nam je! Ako imate 30 sekundi, vaša recenzija na Googleu bi nam puno značila 💛",
    };
  }

  if (input.rating < 4) {
    return {
      kind: "denis_followup",
      message: en
        ? "We're sorry! Can you tell us a bit more so we can improve?"
        : "Žao nam je! Možete li nam reći više?",
    };
  }

  return {
    kind: "thanks_only",
    message: en ? "Thank you for your feedback!" : "Hvala na povratnoj informaciji!",
  };
}

export function resolveDishRecommendationPolicy(
  avgRating: number | null
): DishRecommendationPolicy {
  if (avgRating == null) return "neutral";
  if (avgRating < DISH_SUPPRESS_RATING_THRESHOLD) return "suppress";
  if (avgRating > DISH_PROMOTE_RATING_THRESHOLD) return "promote";
  return "neutral";
}

export function aggregateProductFeedbackRatings(input: {
  rows: Array<{
    rating: number;
    productName: string;
  }>;
}): Record<string, { avgRating: number; count: number }> {
  const buckets = new Map<string, { total: number; count: number }>();

  for (const row of input.rows) {
    const key = row.productName.trim().toLowerCase();
    if (!key) continue;
    const prev = buckets.get(key) ?? { total: 0, count: 0 };
    buckets.set(key, {
      total: prev.total + row.rating,
      count: prev.count + 1,
    });
  }

  const result: Record<string, { avgRating: number; count: number }> = {};
  for (const [name, bucket] of buckets) {
    result[name] = {
      avgRating: bucket.total / bucket.count,
      count: bucket.count,
    };
  }
  return result;
}

/** Trend alert e.g. "5 negativnih komentara o Schnitzelu ove nedelje". */
export function detectDishFeedbackTrend(input: {
  feedbacks: Array<{
    comment?: string | null;
    sentiment: FeedbackSentiment;
    createdAt: string;
  }>;
  dishName: string;
  lookbackDays: number;
  nowMs?: number;
}): { negativeCount: number; alertMessage: string | null } {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.lookbackDays * 86_400_000;
  const dish = input.dishName.trim().toLowerCase();

  const negativeCount = input.feedbacks.filter((row) => {
    if (row.sentiment !== "negative") return false;
    const t = Date.parse(row.createdAt);
    if (!Number.isFinite(t) || t < nowMs - windowMs) return false;
    const comment = normalizeComment(row.comment);
    return comment.includes(dish);
  }).length;

  const alertMessage =
    negativeCount >= FEEDBACK_TREND_MIN_NEGATIVE
      ? `${negativeCount} negativnih komentara o ${input.dishName} ove nedelje`
      : null;

  return { negativeCount, alertMessage };
}

/** 3+ slow-service comments → staff training insight. */
export function buildFeedbackTrainingInsights(input: {
  feedbacks: Array<{
    comment?: string | null;
    sentiment: FeedbackSentiment;
    category: FeedbackCategory | null;
    createdAt: string;
  }>;
  lookbackDays: number;
  periodDays: number;
  nowMs?: number;
}): TrainingInsight[] {
  const nowMs = input.nowMs ?? Date.now();
  const windowMs = input.lookbackDays * 86_400_000;

  let slowServiceCount = 0;
  for (const row of input.feedbacks) {
    const t = Date.parse(row.createdAt);
    if (!Number.isFinite(t) || t < nowMs - windowMs) continue;

    const analysis = analyzeFeedbackComment({
      rating: row.sentiment === "negative" ? 2 : 4,
      comment: row.comment,
      sentiment: row.sentiment,
    });

    if (
      analysis.tags.includes("slow_service") ||
      (row.category === "service" && row.sentiment === "negative") ||
      (row.category === "wait_time" && row.sentiment === "negative")
    ) {
      slowServiceCount += 1;
    }
  }

  if (slowServiceCount < SLOW_SERVICE_TRAINING_THRESHOLD) {
    return [];
  }

  return [
    {
      area: "speed",
      severity: slowServiceCount >= 5 ? "action_needed" : "info",
      title: `Spori servis — ${slowServiceCount} feedback komentara u poslednjih ${input.periodDays} dana`,
      detail: "Gosti spominju sporo usluživanje ili dugo čekanje u komentarima",
      dataPoints: slowServiceCount,
      suggestedTraining:
        "Preporučujemo: Service speed workshop — proaktivni obilazak i ETA komunikacija",
    },
  ];
}

export function formatFeedbackDigestLines(insight: FeedbackInsight): string[] {
  if (insight.totalCount === 0) {
    return ["Još nema feedback-a u ovom periodu."];
  }

  const positivePct = Math.round(insight.positiveRate * 100);
  const trend =
    insight.priorPositiveRate == null
      ? "nema prethodnog perioda"
      : insight.trendDirection === "improving"
        ? `prošli period ${Math.round(insight.priorPositiveRate * 100)}% — trending UP`
        : insight.trendDirection === "declining"
          ? `prošli period ${Math.round(insight.priorPositiveRate * 100)}% — trending DOWN`
          : `prošli period ${Math.round(insight.priorPositiveRate * 100)}% — stabilno`;

  const lines = [`${positivePct}% pozitivnih (${trend})`];

  if (insight.negativeCount > 0 && insight.topComplaintCategory) {
    lines.push(
      `Top pritužba: ${insight.topComplaintCategory} (${insight.topComplaintCount} od ${insight.negativeCount} negativnih)`
    );
  }

  if (insight.suggestedFix) {
    lines.push(`Preporuka: ${insight.suggestedFix}`);
  }

  return lines;
}
