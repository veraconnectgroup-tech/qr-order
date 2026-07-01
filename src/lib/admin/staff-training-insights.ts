export type TrainingInsightArea =
  | "speed"
  | "communication"
  | "upsell"
  | "allergy"
  | "attention";

export type TrainingInsightSeverity = "info" | "action_needed" | "critical";

export type TrainingInsight = {
  area: TrainingInsightArea;
  severity: TrainingInsightSeverity;
  title: string;
  detail: string;
  dataPoints: number;
  suggestedTraining: string;
};

export type FrustrationEvent = {
  sessionId: string;
  productName?: string | null;
  station?: string | null;
};

export type WaitTimeStat = {
  productName: string;
  orderCount: number;
  avgMinutes: number;
  targetMinutes: number;
  frustrationCount: number;
};

export type AllergyAlert = {
  sessionId: string;
  isNearMiss?: boolean;
};

export type IdleTableEvent = {
  sessionId: string;
  idleMinutes: number;
};

export type UpsellStat = {
  totalSessions: number;
  denisDessertNudges: number;
  staffDessertOffers: number;
};

export type HandoffStat = {
  totalSessions: number;
  handoffCount: number;
};

export type StaffPerformanceStat = {
  staffId: string;
  staffName: string;
  orderCount: number;
  avgResponseMinutes: number;
  complaintCount: number;
};

export type StaffPerformanceInsight = {
  staffId: string;
  staffName: string;
  orderCount: number;
  avgResponseMinutes: number;
  complaintCount: number;
  recommendedAreas: TrainingInsightArea[];
  summary: string;
};

export type StaffLeaderboardMetric =
  | "fastest_response"
  | "most_tips"
  | "best_rating";

export type StaffLeaderboardEntry = {
  staffId: string;
  staffName: string;
  metric: StaffLeaderboardMetric;
  value: number;
  displayValue: string;
  rank: number;
};

export type TrainingRecommendation = {
  area: TrainingInsightArea;
  message: string;
  severity: TrainingInsightSeverity;
};

export const MIN_TRAINING_DATA_POINTS = 20;
export const SPEED_FRUSTRATION_THRESHOLD = 5;
export const HANDOFF_RATE_THRESHOLD = 0.2;
const DENIS_DESSERT_SHARE_THRESHOLD = 0.8;
const STAFF_SPEED_RESPONSE_MINUTES = 6;
const STAFF_ATTENTION_RESPONSE_MINUTES = 7;
const STAFF_COMMUNICATION_COMPLAINTS = 3;
const STAFF_ATTENTION_COMPLAINTS = 4;

function insightPriority(insight: TrainingInsight): number {
  const severityBoost =
    insight.severity === "critical"
      ? 2000
      : insight.severity === "action_needed"
        ? 1000
        : 0;
  const areaWeight: Record<TrainingInsightArea, number> = {
    allergy: 500,
    speed: 400,
    attention: 350,
    communication: 200,
    upsell: 100,
  };
  return severityBoost + areaWeight[insight.area] + insight.dataPoints;
}

/** Generate owner-facing staff training insights from Denis ops data (R1). */
export function generateStaffTrainingInsights(input: {
  frustrationEvents: FrustrationEvent[];
  waitTimes: WaitTimeStat[];
  allergyAlerts: AllergyAlert[];
  idleTableEvents: IdleTableEvent[];
  upsellConversions: UpsellStat[];
  handoffStats?: HandoffStat[];
  periodDays: number;
}): TrainingInsight[] {
  const insights: TrainingInsight[] = [];

  const nearMissAlerts = input.allergyAlerts.filter((alert) => alert.isNearMiss);
  if (nearMissAlerts.length > 0) {
    insights.push({
      area: "allergy",
      severity: "critical",
      title: `Allergy near-miss — ${nearMissAlerts.length} incident(a) u poslednjih ${input.periodDays} dana`,
      detail: "Denis je eskalirao potencijalni alergen prije slanja u kuhinju",
      dataPoints: nearMissAlerts.length,
      suggestedTraining:
        "Preporučujemo: Allergy awareness session (hitno — near-miss)",
    });
  }

  for (const stat of input.waitTimes) {
    if (stat.orderCount < MIN_TRAINING_DATA_POINTS) continue;

    const overTarget = stat.avgMinutes > stat.targetMinutes;
    const frustrationHeavy =
      stat.frustrationCount >= SPEED_FRUSTRATION_THRESHOLD;

    if (!overTarget && !frustrationHeavy) continue;

    insights.push({
      area: "speed",
      severity: frustrationHeavy || overTarget ? "action_needed" : "info",
      title: overTarget
        ? `Prep time za ${stat.productName} je previsok (${stat.avgMinutes} min, target ${stat.targetMinutes} min)`
        : `Prep time za ${stat.productName} je previsok — ${stat.frustrationCount} frustration signala`,
      detail: `${stat.orderCount} narudžbi, ${stat.frustrationCount} frustration events`,
      dataPoints: stat.orderCount,
      suggestedTraining: overTarget
        ? `Trening za ${stat.productName} stanicu — batch prep u gužvi`
        : `Proveri ETA komunikaciju za ${stat.productName} pre nego gost pita`,
    });
  }

  const handoff = input.handoffStats?.[0];
  if (handoff && handoff.totalSessions >= MIN_TRAINING_DATA_POINTS) {
    const handoffRate =
      handoff.handoffCount / Math.max(handoff.totalSessions, 1);
    if (handoffRate > HANDOFF_RATE_THRESHOLD) {
      insights.push({
        area: "communication",
        severity: "action_needed",
        title: `Staff ne odgovara dovoljno brzo — ${Math.round(handoffRate * 100)}% sesija završilo Denis handoff-om`,
        detail: `${handoff.handoffCount} handoff-ova od ${handoff.totalSessions} sesija`,
        dataPoints: handoff.handoffCount,
        suggestedTraining:
          "Kratko objasni meni i ETA pri prvom kontaktu — manje follow-up pitanja",
      });
    }
  }

  const upsell = input.upsellConversions[0];
  if (upsell && upsell.totalSessions >= MIN_TRAINING_DATA_POINTS) {
    const denisShare =
      upsell.denisDessertNudges /
      Math.max(upsell.denisDessertNudges + upsell.staffDessertOffers, 1);

    if (
      upsell.denisDessertNudges >= MIN_TRAINING_DATA_POINTS &&
      denisShare >= DENIS_DESSERT_SHARE_THRESHOLD
    ) {
      insights.push({
        area: "upsell",
        severity: "info",
        title: `Staff ne nudi desert — Denis preuzeo ${Math.round(denisShare * 100)}% dessert nudge-ova`,
        detail: `${upsell.totalSessions} sesija, samo ${upsell.staffDessertOffers} staff-initiated dessert offers`,
        dataPoints: upsell.totalSessions,
        suggestedTraining:
          "Preporučujemo: Upsell techniques (Denis nosi većinu dessert nudge-ova)",
      });
    }
  }

  const idleCount = input.idleTableEvents.filter(
    (event) => event.idleMinutes >= 10
  ).length;

  if (idleCount >= MIN_TRAINING_DATA_POINTS) {
    insights.push({
      area: "attention",
      severity: "action_needed",
      title: `Stolovi bez pažnje — ${idleCount} idle alerta (>10 min) u poslednjih ${input.periodDays} dana`,
      detail: `Denis poslao ${idleCount} attention/idle alertova`,
      dataPoints: idleCount,
      suggestedTraining: "Redovnije obilazi stolove, posebno u 13-15h",
    });
  }

  const nonNearMissAlerts = input.allergyAlerts.filter((alert) => !alert.isNearMiss);
  if (nonNearMissAlerts.length >= MIN_TRAINING_DATA_POINTS) {
    insights.push({
      area: "allergy",
      severity:
        nonNearMissAlerts.length >= MIN_TRAINING_DATA_POINTS * 2
          ? "action_needed"
          : "info",
      title: `${nonNearMissAlerts.length} allergy alerta u poslednjih ${input.periodDays} dana`,
      detail: "Denis je eskalirao alergene na staff surface",
      dataPoints: nonNearMissAlerts.length,
      suggestedTraining:
        "Refresher: potvrdi alergene pri narudžbi i pre slanja u kuhinju",
    });
  }

  const communicationEvents = input.frustrationEvents.filter(
    (event) => !event.productName
  );
  if (
    communicationEvents.length >= MIN_TRAINING_DATA_POINTS &&
    !insights.some((row) => row.area === "communication")
  ) {
    insights.push({
      area: "communication",
      severity: "info",
      title: `${communicationEvents.length} sesija sa ponovljenim pitanjima ili negativnim tonom`,
      detail: "Frustration signali bez jasnog kitchen delay uzroka",
      dataPoints: communicationEvents.length,
      suggestedTraining:
        "Kratko objasni meni i ETA pri prvom kontaktu — manje follow-up pitanja",
    });
  }

  return insights.sort((a, b) => insightPriority(b) - insightPriority(a));
}

/** Per-staff training needs from order volume, response time, and complaints. */
export function analyzeStaffPerformance(
  rows: StaffPerformanceStat[]
): StaffPerformanceInsight[] {
  return rows
    .filter((row) => row.orderCount >= MIN_TRAINING_DATA_POINTS)
    .map((row) => {
      const recommendedAreas: TrainingInsightArea[] = [];

      if (row.avgResponseMinutes >= STAFF_SPEED_RESPONSE_MINUTES) {
        recommendedAreas.push("speed");
      }
      if (row.complaintCount >= STAFF_COMMUNICATION_COMPLAINTS) {
        recommendedAreas.push("communication");
      }
      if (
        row.avgResponseMinutes >= STAFF_ATTENTION_RESPONSE_MINUTES ||
        row.complaintCount >= STAFF_ATTENTION_COMPLAINTS
      ) {
        if (!recommendedAreas.includes("attention")) {
          recommendedAreas.push("attention");
        }
      }

      const areaLabel =
        recommendedAreas.length > 0
          ? recommendedAreas.join(" + ")
          : "nema hitnih oblasti";

      return {
        ...row,
        recommendedAreas,
        summary:
          recommendedAreas.length > 0
            ? `${row.staffName} treba ${areaLabel} training`
            : `${row.staffName}: stabilan performans (${row.orderCount} narudžbina, avg ${row.avgResponseMinutes} min)`,
      };
    })
    .sort((a, b) => b.complaintCount - a.complaintCount);
}

/** Owner-facing training recommendations aggregated from insights. */
export function buildTrainingRecommendations(input: {
  insights: TrainingInsight[];
  staffPerformance?: StaffPerformanceInsight[];
  periodDays: number;
}): TrainingRecommendation[] {
  const recommendations: TrainingRecommendation[] = [];

  const allergyNearMiss = input.insights.find(
    (row) => row.area === "allergy" && row.severity === "critical"
  );
  if (allergyNearMiss) {
    recommendations.push({
      area: "allergy",
      severity: "critical",
      message: `Preporučujemo: Allergy awareness session (${allergyNearMiss.dataPoints} near-miss ove nedelje)`,
    });
  }

  const upsell = input.insights.find((row) => row.area === "upsell");
  if (upsell) {
    const denisShareMatch = upsell.title.match(/(\d+)%/);
    const share = denisShareMatch?.[1] ?? "80";
    recommendations.push({
      area: "upsell",
      severity: upsell.severity,
      message: `Preporučujemo: Upsell techniques (Denis nosi ${share}% upsell-a)`,
    });
  }

  for (const staff of input.staffPerformance ?? []) {
    if (staff.recommendedAreas.length === 0) continue;
    recommendations.push({
      area: staff.recommendedAreas[0]!,
      severity: "action_needed",
      message: staff.summary,
    });
  }

  for (const insight of input.insights) {
    if (insight.severity === "info") continue;
    if (recommendations.some((row) => row.area === insight.area)) continue;
    recommendations.push({
      area: insight.area,
      severity: insight.severity,
      message: insight.suggestedTraining,
    });
  }

  return recommendations.slice(0, 6);
}

/** Opt-in staff leaderboard — fastest response, tips, ratings. */
export function buildStaffLeaderboard(input: {
  performance: StaffPerformanceStat[];
  tipsByStaffId: Record<string, number>;
  ratingsByStaffId: Record<string, { sum: number; count: number }>;
  optedInStaffIds: Set<string>;
}): StaffLeaderboardEntry[] {
  if (input.optedInStaffIds.size === 0) return [];

  const eligible = input.performance.filter((row) =>
    input.optedInStaffIds.has(row.staffId)
  );
  if (eligible.length === 0) return [];

  const entries: StaffLeaderboardEntry[] = [];

  const byResponse = [...eligible]
    .filter((row) => row.avgResponseMinutes > 0)
    .sort((a, b) => a.avgResponseMinutes - b.avgResponseMinutes);
  if (byResponse[0]) {
    entries.push({
      staffId: byResponse[0].staffId,
      staffName: byResponse[0].staffName,
      metric: "fastest_response",
      value: byResponse[0].avgResponseMinutes,
      displayValue: `${byResponse[0].avgResponseMinutes} min`,
      rank: 1,
    });
  }

  const byTips = [...eligible]
    .map((row) => ({
      ...row,
      tipTotal: input.tipsByStaffId[row.staffId] ?? 0,
    }))
    .filter((row) => row.tipTotal > 0)
    .sort((a, b) => b.tipTotal - a.tipTotal);
  if (byTips[0]) {
    entries.push({
      staffId: byTips[0].staffId,
      staffName: byTips[0].staffName,
      metric: "most_tips",
      value: byTips[0].tipTotal,
      displayValue: `€${byTips[0].tipTotal.toFixed(2)}`,
      rank: 1,
    });
  }

  const byRating = [...eligible]
    .map((row) => {
      const rating = input.ratingsByStaffId[row.staffId];
      const avg =
        rating && rating.count > 0 ? rating.sum / rating.count : null;
      return { ...row, avgRating: avg };
    })
    .filter((row) => row.avgRating != null)
    .sort((a, b) => (b.avgRating ?? 0) - (a.avgRating ?? 0));
  if (byRating[0]?.avgRating != null) {
    entries.push({
      staffId: byRating[0].staffId,
      staffName: byRating[0].staffName,
      metric: "best_rating",
      value: byRating[0].avgRating,
      displayValue: `${byRating[0].avgRating.toFixed(1)}/5`,
      rank: 1,
    });
  }

  return entries;
}

export type StaffTrainingSummary = {
  topAreas: TrainingInsightArea[];
  trendLines: string[];
  actionLines: string[];
};

/** Top training areas + trend vs prior period for owner digest (R1). */
export function summarizeStaffTrainingInsights(input: {
  insights: TrainingInsight[];
  priorInsights?: TrainingInsight[];
  periodDays: number;
}): StaffTrainingSummary {
  const topAreas = input.insights.slice(0, 3).map((row) => row.area);

  const trendLines =
    input.priorInsights && input.priorInsights.length > 0
      ? input.insights.slice(0, 3).map((insight) => {
          const prior = input.priorInsights!.find((row) => row.area === insight.area);
          if (!prior) return `${insight.area}: novo u periodu`;
          const delta = insight.dataPoints - prior.dataPoints;
          const direction =
            delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
          return `${insight.area}: ${direction} (${prior.dataPoints} → ${insight.dataPoints} data points)`;
        })
      : ["Nema prethodnog perioda za trend poređenje."];

  const actionLines = input.insights
    .filter(
      (row) => row.severity === "action_needed" || row.severity === "critical"
    )
    .slice(0, 3)
    .map((row) => row.suggestedTraining);

  if (actionLines.length === 0 && input.insights[0]) {
    actionLines.push(input.insights[0].suggestedTraining);
  }

  return {
    topAreas,
    trendLines,
    actionLines,
  };
}

/** Owner digest lines for staff training section (R1). */
export function formatStaffTrainingDigestLines(input: {
  insights: TrainingInsight[];
  summary: StaffTrainingSummary;
  periodDays: number;
  recommendations?: TrainingRecommendation[];
}): string[] {
  if (input.insights.length === 0) {
    return ["Još nema dovoljno operativnih podataka za staff training insights."];
  }

  const lines = [
    `Top oblasti: ${input.summary.topAreas.join(", ") || "—"}`,
    ...input.summary.trendLines.map((line) => `Trend: ${line}`),
  ];

  for (const insight of input.insights.slice(0, 3)) {
    const prefix =
      insight.severity === "critical"
        ? "🚨"
        : insight.severity === "action_needed"
          ? "⚠️"
          : "ℹ️";
    lines.push(
      `${prefix} ${insight.area.toUpperCase()}: ${insight.title}`,
      `Podaci: ${insight.detail}`,
      `Preporuka: ${insight.suggestedTraining}`
    );
  }

  for (const rec of input.recommendations ?? []) {
    lines.push(`Preporučujemo: ${rec.message}`);
  }

  if (input.summary.actionLines.length > 0) {
    lines.push(`Konkretne akcije: ${input.summary.actionLines.join(" · ")}`);
  }

  return lines;
}
