import type { FeedbackInsight } from "@/lib/denis/platform/feedback-intelligence";
import type { MenuItemAnalysis } from "@/lib/denis/platform/menu-engineering";
import type { ThresholdMetric } from "@/lib/denis/learning/threshold-optimizer";
import type {
  AiInsightsMenuGap,
  AiInsightsSummary,
} from "@/lib/dashboard/ai-insights-data";

export type ActionableInsightType =
  | "opportunity"
  | "problem"
  | "achievement"
  | "experiment_result";

export type ActionableInsightImpact = "high" | "medium" | "low";

export type ActionableInsight = {
  id: string;
  type: ActionableInsightType;
  title: string;
  detail: string;
  impact: ActionableInsightImpact;
  suggestedAction: string;
  metric: { before: number; after: number; unit: string } | null;
};

export type GenerateActionableInsightsInput = {
  currentPeriod: AiInsightsSummary;
  previousPeriod: AiInsightsSummary;
  menuGaps: AiInsightsMenuGap[];
  feedbackTrends?: FeedbackInsight | null;
  menuAnalysis?: MenuItemAnalysis[];
  thresholdOpt?: ThresholdMetric[];
  /** Conservative revenue multiplier for estimates (O1 spec: ×0.7). */
  revenueEstimateFactor?: number;
  maxInsights?: number;
  /** Average dessert menu price in major currency units (e.g. 400 RSD). */
  avgDessertPrice?: number;
  currencyLabel?: string;
  revenueBriefing?: RevenueBriefing | null;
  prepTimeAlerts?: PrepTimeAlert[];
  slowKitchenSignalCount?: number;
  abExperiments?: AbExperimentInsight[];
};

export type RevenueBriefing = {
  revenue: number;
  revenueChangePct: number | null;
  orderCount: number;
  avgTicket: number;
  currencyLabel?: string;
};

export type PrepTimeAlert = {
  productName: string;
  avgMinutes: number;
  targetMinutes: number;
  frustrationCount: number;
};

export type AbExperimentInsight = {
  experimentId: string;
  label: string;
  variantALabel: string;
  variantBLabel: string;
  liftPct: number;
  winner: "A" | "B" | "inconclusive";
};

export type InsightDeliveryTier = "critical" | "daily" | "weekly";

const DEFAULT_REVENUE_FACTOR = 0.7;
const DEFAULT_MAX_INSIGHTS = 5;
const MIN_MENU_GAP_COUNT = 3;
const SLOW_KITCHEN_SIGNAL_THRESHOLD = 5;
const MIN_PREP_FRUSTRATION = 5;

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function pctChange(before: number, after: number): number | null {
  if (before <= 0) return null;
  return (after - before) / before;
}

function formatMoney(amount: number, currencyLabel: string): string {
  const rounded = Math.round(amount);
  return `~${rounded.toLocaleString("sr-RS")} ${currencyLabel}`;
}

function insightFromRevenueBriefing(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const briefing = input.revenueBriefing;
  if (!briefing || briefing.orderCount <= 0) return [];

  const currency = briefing.currencyLabel ?? input.currencyLabel ?? "€";
  const change =
    briefing.revenueChangePct != null
      ? `${briefing.revenueChangePct >= 0 ? "+" : ""}${Math.round(briefing.revenueChangePct * 100)}%`
      : null;

  return [
    {
      id: "achievement-daily-revenue",
      type: "achievement",
      title: change
        ? `Juče: ${formatMoney(briefing.revenue, currency)} prihod (${change})`
        : `Juče: ${formatMoney(briefing.revenue, currency)} prihod`,
      detail: `${briefing.orderCount} narudžbina, avg ${formatMoney(briefing.avgTicket, currency)}`,
      impact: briefing.revenueChangePct != null && briefing.revenueChangePct >= 0.1 ? "high" : "medium",
      suggestedAction: "Pregledaj dnevni izveštaj za breakdown po stavkama i kanalima.",
      metric:
        briefing.revenueChangePct != null
          ? {
              before: Math.round((1 - briefing.revenueChangePct) * 100),
              after: 100,
              unit: "% vs prethodni dan",
            }
          : null,
    },
  ];
}

function insightFromPrepTimeAlerts(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const out: ActionableInsight[] = [];

  for (const alert of input.prepTimeAlerts ?? []) {
    const overTarget = alert.avgMinutes > alert.targetMinutes;
    const frustrationHeavy = alert.frustrationCount >= MIN_PREP_FRUSTRATION;
    if (!overTarget && !frustrationHeavy) continue;

    out.push({
      id: `problem-prep-${slug(alert.productName)}`,
      type: "problem",
      title: `${alert.productName} prep time je ${alert.avgMinutes}min (target: ${alert.targetMinutes}min)`,
      detail: frustrationHeavy
        ? `${alert.frustrationCount} frustrirana gosta u periodu`
        : `Prosečno kašnjenje iznad targeta za ${alert.productName}`,
      impact: frustrationHeavy ? "high" : "medium",
      suggestedAction: `Proveri ${alert.productName} stanicu — batch prep ili raniji ETA signal gostima.`,
      metric: {
        before: alert.targetMinutes,
        after: alert.avgMinutes,
        unit: "min",
      },
    });
  }

  return out;
}

function insightFromSlowKitchenSignals(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const count = input.slowKitchenSignalCount ?? 0;
  if (count < SLOW_KITCHEN_SIGNAL_THRESHOLD) return [];

  return [
    {
      id: "problem-slow-kitchen",
      type: "problem",
      title: `Spora kuhinja — ${count} slow_kitchen signala`,
      detail: `Denis je više puta poslao empathy poruke zbog kašnjenja iz kuhinje (${count} slow_kitchen signala).`,
      impact: "high",
      suggestedAction:
        "Dodaj kapacitet u peak satima ili smanji kompleksne stavke na meniju.",
      metric: {
        before: 0,
        after: count,
        unit: "signala",
      },
    },
  ];
}

function insightFromAbExperiments(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const out: ActionableInsight[] = [];

  for (const experiment of input.abExperiments ?? []) {
    if (experiment.winner === "inconclusive" || experiment.liftPct < 0.05) continue;

    out.push({
      id: `experiment-${slug(experiment.experimentId)}`,
      type: "experiment_result",
      title: `${experiment.label}: +${Math.round(experiment.liftPct * 100)}% conversion`,
      detail: `${experiment.variantALabel} vs ${experiment.variantBLabel} — pobednik: varijanta ${experiment.winner}.`,
      impact: experiment.liftPct >= 0.15 ? "high" : "medium",
      suggestedAction: "Primeni pobednika u Admin → Denis Insights?",
      metric: {
        before: Math.round((1 - experiment.liftPct) * 100),
        after: 100,
        unit: "% lift",
      },
    });
  }

  return out;
}

function insightFromMenuGaps(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const factor = input.revenueEstimateFactor ?? DEFAULT_REVENUE_FACTOR;
  const currency = input.currencyLabel ?? "RSD";
  const avgPrice = input.avgDessertPrice ?? 400;
  const out: ActionableInsight[] = [];

  for (const gap of input.menuGaps) {
    if (gap.count < MIN_MENU_GAP_COUNT) continue;
    const term = gap.term.trim();
    if (!term) continue;

    const weeklyRevenue = gap.count * avgPrice * factor;
    const impact: ActionableInsightImpact =
      gap.count >= 10 ? "high" : gap.count >= 6 ? "medium" : "low";

    out.push({
      id: `menu-gap-${slug(term)}`,
      type: "opportunity",
      title: `Dodaj ${term.charAt(0).toUpperCase()}${term.slice(1)} na meni`,
      detail: `${gap.count} gostiju u periodu tražilo „${term}”. Nema ga na meniju. Procijenjeni prihod: ${formatMoney(weeklyRevenue, currency)}/sedmica.`,
      impact,
      suggestedAction: `Dodaj „${term}” na meni ili pripremi Denis alias/preporuku zamene.`,
      metric: {
        before: 0,
        after: gap.count,
        unit: "traženja",
      },
    });
  }

  return out;
}

function insightFromConversion(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const current = input.currentPeriod.conversionRate;
  const previous = input.previousPeriod.conversionRate;
  const delta = pctChange(previous, current);
  if (delta == null || delta < 0.15) return [];

  return [
    {
      id: "achievement-conversion",
      type: "achievement",
      title: `Denis konverzija +${Math.round(delta * 100)}%`,
      detail: `Stopa prihvatanja preporuka: ${Math.round(current * 100)}% (prethodni period: ${Math.round(previous * 100)}%).`,
      impact: delta >= 0.3 ? "high" : "medium",
      suggestedAction:
        "Nastavi sa trenutnim playbook-om i threshold-ima — momentum je dobar.",
      metric: {
        before: Math.round(previous * 100),
        after: Math.round(current * 100),
        unit: "%",
      },
    },
  ];
}

function insightFromDessertThreshold(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const dessert = (input.thresholdOpt ?? []).find(
    (row) => row.key === "dessertDelayMinutes"
  );
  if (!dessert || dessert.confidence < 0.85) return [];

  const lift = dessert.conversionAtOptimal - dessert.conversionAtCurrent;
  if (lift < 0.05) return [];

  return [
    {
      id: "achievement-dessert-threshold",
      type: "achievement",
      title: `Desert nudge +${Math.round(lift * 100)}% accept`,
      detail: `Optimalno kašnjenje ${dessert.optimalValue} min daje ${Math.round(dessert.conversionAtOptimal * 100)}% accept (trenutno ${dessert.currentValue} min → ${Math.round(dessert.conversionAtCurrent * 100)}%).`,
      impact: lift >= 0.1 ? "high" : "medium",
      suggestedAction: `Odobri promenu dessertDelay na ${dessert.optimalValue} min u Admin → Denis Insights.`,
      metric: {
        before: Math.round(dessert.conversionAtCurrent * 100),
        after: Math.round(dessert.conversionAtOptimal * 100),
        unit: "% accept",
      },
    },
  ];
}

function insightFromFeedback(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const feedback = input.feedbackTrends;
  if (!feedback?.actionRequired) return [];

  const category = feedback.topComplaintCategory ?? "other";
  const out: ActionableInsight[] = [];

  if (category === "wait_time" || feedback.waitTimeNegativeShare >= 0.4) {
    const waitPct = Math.round(feedback.waitTimeNegativeShare * 100);
    out.push({
      id: "problem-wait-time",
      type: "problem",
      title: "Čekanje raste u feedback-u",
      detail: `${waitPct}% negativnih komentara se odnosi na čekanje. Denis je u periodu slao empathy poruke za kašnjenje.`,
      impact: feedback.recentNegativeRate >= 0.35 ? "high" : "medium",
      suggestedAction:
        feedback.suggestedFix ??
        "Dodaj kapacitet u kuhinji ili smanji kompleksne stavke u peak satima.",
      metric: feedback.priorPositiveRate != null
        ? {
            before: Math.round(feedback.priorPositiveRate * 100),
            after: Math.round(feedback.positiveRate * 100),
            unit: "% pozitivnih",
          }
        : null,
    });
  }

  if (category === "food" && feedback.topComplaintCount >= 2) {
    out.push({
      id: "problem-food-quality",
      type: "problem",
      title: "Feedback upozorava na hranu",
      detail: `${feedback.topComplaintCount} pritužbi na kvalitet hrane u periodu.`,
      impact: "medium",
      suggestedAction:
        feedback.suggestedFix ??
        "Proveri peak-hour kvalitet i temperaturu jela pre servisa.",
      metric: null,
    });
  }

  return out;
}

function insightFromMenuEngineering(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const items = input.menuAnalysis ?? [];
  const dogs = items.filter((row) => row.category === "dog" && row.orderCount >= 3);
  if (dogs.length === 0) return [];

  const worst = [...dogs].sort((a, b) => a.orderCount - b.orderCount)[0]!;
  return [
    {
      id: `problem-menu-dog-${slug(worst.name)}`,
      type: "problem",
      title: `${worst.name} — slaba prodaja`,
      detail: `${worst.name} je „dog” stavka (${worst.orderCount} porudžbina). ${worst.suggestion}.`,
      impact: "medium",
      suggestedAction: `Razmotri uklanjanje, repozicioniranje ili bundle sa star stavkom.`,
      metric: {
        before: worst.orderCount,
        after: 0,
        unit: "porudžbina",
      },
    },
  ];
}

function insightFromThresholdExperiments(input: GenerateActionableInsightsInput): ActionableInsight[] {
  const suggestions = (input.thresholdOpt ?? []).filter(
    (row) =>
      row.confidence >= 0.9 &&
      row.optimalValue !== row.currentValue &&
      row.sampleSize >= 50
  );
  if (suggestions.length === 0) return [];

  const top = suggestions[0]!;
  return [
    {
      id: `experiment-threshold-${slug(top.key)}`,
      type: "experiment_result",
      title: `Threshold optimizacija: ${top.key}`,
      detail: `Denis predlaže ${top.currentValue} → ${top.optimalValue} min (${Math.round(top.conversionAtOptimal * 100)}% vs ${Math.round(top.conversionAtCurrent * 100)}% accept, n=${top.sampleSize}).`,
      impact: top.confidence >= 0.95 ? "high" : "medium",
      suggestedAction: "Pregledaj i odobri u Dashboard → Timing ili Admin → Denis Insights.",
      metric: {
        before: top.currentValue,
        after: top.optimalValue,
        unit: "min",
      },
    },
  ];
}

const IMPACT_RANK: Record<ActionableInsightImpact, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Owner-facing actionable insights — max 5/day, svaki sa suggestedAction (O1). */
export function generateActionableInsights(
  input: GenerateActionableInsightsInput
): ActionableInsight[] {
  const maxInsights = input.maxInsights ?? DEFAULT_MAX_INSIGHTS;

  const merged = [
    ...insightFromRevenueBriefing(input),
    ...insightFromMenuGaps(input),
    ...insightFromPrepTimeAlerts(input),
    ...insightFromSlowKitchenSignals(input),
    ...insightFromConversion(input),
    ...insightFromDessertThreshold(input),
    ...insightFromFeedback(input),
    ...insightFromMenuEngineering(input),
    ...insightFromThresholdExperiments(input),
    ...insightFromAbExperiments(input),
  ];

  const unique = new Map<string, ActionableInsight>();
  for (const row of merged) {
    if (!unique.has(row.id)) unique.set(row.id, row);
  }

  return [...unique.values()]
    .sort((a, b) => {
      const impactDiff = IMPACT_RANK[a.impact] - IMPACT_RANK[b.impact];
      if (impactDiff !== 0) return impactDiff;
      return a.title.localeCompare(b.title);
    })
    .slice(0, maxInsights);
}

export function insightDeliveryTier(
  insight: ActionableInsight
): InsightDeliveryTier {
  if (insight.type === "problem" && insight.impact === "high") {
    return "critical";
  }
  if (insight.impact === "high") return "daily";
  return "weekly";
}

export function formatActionableInsightLine(insight: ActionableInsight): string {
  const icon =
    insight.type === "opportunity"
      ? "🎯"
      : insight.type === "problem"
        ? "⚠️"
        : insight.type === "achievement"
          ? "✅"
          : "🧪";
  return `${icon} ${insight.title} — ${insight.suggestedAction}`;
}

export function formatActionableInsightsDigestSection(
  insights: ActionableInsight[]
): string[] {
  if (insights.length === 0) return [];
  return [
    "ACTIONABLE INSIGHTS:",
    ...insights.map((row) => `- ${formatActionableInsightLine(row)}`),
    ...insights.map((row) => `  ${row.detail}`),
  ];
}

/** Top N insights for dashboard widget (O1). */
export function topActionableInsights(
  insights: ActionableInsight[],
  limit = 3
): ActionableInsight[] {
  return insights.slice(0, limit);
}

export function buildDailyBriefingHeadline(
  input: GenerateActionableInsightsInput
): string | null {
  const briefing = input.revenueBriefing;
  if (!briefing || briefing.orderCount <= 0) return null;

  const currency = briefing.currencyLabel ?? input.currencyLabel ?? "€";
  const change =
    briefing.revenueChangePct != null
      ? ` (${briefing.revenueChangePct >= 0 ? "+" : ""}${Math.round(briefing.revenueChangePct * 100)}%)`
      : "";

  return `Juče: ${formatMoney(briefing.revenue, currency)} prihod${change}, ${briefing.orderCount} narudžbina, avg ${formatMoney(briefing.avgTicket, currency)}`;
}
