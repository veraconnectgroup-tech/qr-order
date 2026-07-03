import { computeBillingRoiJustification } from "@/lib/billing/denis-roi";
import { displayPlanName, getPlanTierDefinition } from "@/lib/billing/tiers";
import { fromCents } from "@/lib/format";
import { logger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

export type DenisRoiEventType =
  | "upsell_accepted"
  | "win_back_sent"
  | "win_back_returned"
  | "conversation"
  | "allergy_warning"
  | "allergy_block"
  | "complaint_handled"
  | "complaint_resolved";

export type DenisRoiMetrics = {
  upsellAccepted: number;
  upsellRevenueCents: number;
  winBackSent: number;
  winBackReturned: number;
  winBackRevenueCents: number;
  denisConversations: number;
  estimatedMinutesSaved: number;
  allergyWarnings: number;
  allergyBlocks: number;
  avgGuestRating: number;
  complaintsHandled: number;
  complaintsResolved: number;
};

export type DenisRoiContribution = {
  rank: number;
  label: string;
  detail: string;
  valueEuros: number | null;
  count: number;
};

export type DenisOwnerRoiDashboard = {
  period: { monthLabel: string; start: string; end: string };
  metrics: DenisRoiMetrics;
  plan: { id: string; displayName: string; costEuros: number };
  totalDenisRevenueEuros: number;
  roi: ReturnType<typeof computeBillingRoiJustification>;
  monthlyTrend: Array<{
    month: string;
    revenueEuros: number;
    roiMultiplier: number;
  }>;
  topContributions: DenisRoiContribution[];
};

export const MINUTES_SAVED_PER_CONVERSATION = 2;

export function emptyDenisRoiMetrics(): DenisRoiMetrics {
  return {
    upsellAccepted: 0,
    upsellRevenueCents: 0,
    winBackSent: 0,
    winBackReturned: 0,
    winBackRevenueCents: 0,
    denisConversations: 0,
    estimatedMinutesSaved: 0,
    allergyWarnings: 0,
    allergyBlocks: 0,
    avgGuestRating: 0,
    complaintsHandled: 0,
    complaintsResolved: 0,
  };
}

export function aggregateDenisRoiMetrics(
  rows: Array<{
    event_type: string;
    amount_cents: number;
    quantity: number;
  }>
): DenisRoiMetrics {
  const metrics = emptyDenisRoiMetrics();

  for (const row of rows) {
    const qty = row.quantity ?? 1;
    const cents = row.amount_cents ?? 0;

    switch (row.event_type as DenisRoiEventType) {
      case "upsell_accepted":
        metrics.upsellAccepted += qty;
        metrics.upsellRevenueCents += cents;
        break;
      case "win_back_sent":
        metrics.winBackSent += qty;
        break;
      case "win_back_returned":
        metrics.winBackReturned += qty;
        metrics.winBackRevenueCents += cents;
        break;
      case "conversation":
        metrics.denisConversations += qty;
        metrics.estimatedMinutesSaved += qty * MINUTES_SAVED_PER_CONVERSATION;
        break;
      case "allergy_warning":
        metrics.allergyWarnings += qty;
        break;
      case "allergy_block":
        metrics.allergyBlocks += qty;
        break;
      case "complaint_handled":
        metrics.complaintsHandled += qty;
        break;
      case "complaint_resolved":
        metrics.complaintsResolved += qty;
        break;
      default:
        break;
    }
  }

  return metrics;
}

export function totalDenisAttributedRevenueEuros(metrics: DenisRoiMetrics): number {
  return (
    Math.round(
      ((metrics.upsellRevenueCents + metrics.winBackRevenueCents) / 100) * 100
    ) / 100
  );
}

export function buildTopDenisContributions(
  metrics: DenisRoiMetrics,
  nudgeBreakdown: Array<{ label: string; accepted: number; revenueEuros: number }>
): DenisRoiContribution[] {
  const items: DenisRoiContribution[] = [];

  for (const row of nudgeBreakdown.slice(0, 3)) {
    if (row.accepted <= 0) continue;
    items.push({
      rank: items.length + 1,
      label: row.label,
      detail: `${row.accepted} prihvaćeno`,
      valueEuros: row.revenueEuros,
      count: row.accepted,
    });
  }

  if (metrics.winBackReturned > 0) {
    items.push({
      rank: items.length + 1,
      label: "Win-back SMS",
      detail: `${metrics.winBackReturned} gostiju se vratilo`,
      valueEuros:
        metrics.winBackRevenueCents > 0
          ? Math.round(metrics.winBackRevenueCents) / 100
          : null,
      count: metrics.winBackReturned,
    });
  }

  const allergyTotal = metrics.allergyWarnings + metrics.allergyBlocks;
  if (allergyTotal > 0) {
    items.push({
      rank: items.length + 1,
      label: "Alergen upozorenja",
      detail: `${allergyTotal} sprečenih incidenta`,
      valueEuros: null,
      count: allergyTotal,
    });
  }

  if (metrics.estimatedMinutesSaved > 0) {
    const hours = Math.round((metrics.estimatedMinutesSaved / 60) * 10) / 10;
    items.push({
      rank: items.length + 1,
      label: "Konobar vreme",
      detail: `≈ ${hours}h — nema više ručnog zapisivanja narudžbi`,
      valueEuros: null,
      count: metrics.denisConversations,
    });
  }

  return items.slice(0, 5).map((item, index) => ({ ...item, rank: index + 1 }));
}

export async function recordDenisRoiEvent(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    eventType: DenisRoiEventType;
    amountCents?: number;
    quantity?: number;
    label?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const { error } = await admin.from("denis_roi_events" as never).insert({
    org_id: input.orgId,
    location_id: input.locationId,
    event_type: input.eventType,
    amount_cents: input.amountCents ?? 0,
    quantity: input.quantity ?? 1,
    label: input.label ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    logger.warn("recordDenisRoiEvent failed", {
      eventType: input.eventType,
      error: error.message,
    });
  }
}

type RoiEventRow = {
  event_type: string;
  amount_cents: number;
  quantity: number;
  label: string | null;
  created_at: string;
};

export async function loadDenisRoiEventsForRange(
  admin: SupabaseClient,
  input: {
    locationId: string;
    fromIso: string;
    toIso: string;
  }
): Promise<RoiEventRow[]> {
  const { data, error } = await admin
    .from("denis_roi_events" as never)
    .select("event_type, amount_cents, quantity, label, created_at")
    .eq("location_id", input.locationId)
    .gte("created_at", input.fromIso)
    .lte("created_at", input.toIso);

  if (error) {
    logger.warn("loadDenisRoiEventsForRange failed", { error: error.message });
    return [];
  }

  return (data ?? []) as RoiEventRow[];
}

function monthBounds(reference = new Date()): {
  start: string;
  end: string;
  monthLabel: string;
} {
  const startDate = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const endDate = new Date(
    reference.getFullYear(),
    reference.getMonth() + 1,
    0,
    23,
    59,
    59,
    999
  );
  const monthLabel = startDate.toLocaleDateString("sr-RS", {
    month: "long",
    year: "numeric",
  });
  return {
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    monthLabel,
  };
}

function mergeNudgeBreakdown(
  byNudge: Record<string, { accepted?: number; revenue?: number }> | null | undefined
): Array<{ label: string; accepted: number; revenueEuros: number }> {
  return Object.entries(byNudge ?? {})
    .map(([label, stats]) => ({
      label,
      accepted: stats?.accepted ?? 0,
      revenueEuros: Number(stats?.revenue ?? 0),
    }))
    .filter((row) => row.accepted > 0 || row.revenueEuros > 0)
    .sort((a, b) => b.revenueEuros - a.revenueEuros);
}

export async function loadDenisOwnerRoiDashboard(
  admin: SupabaseClient,
  input: {
    orgId: string;
    locationId: string;
    planId: string;
    planPriceCents: number;
    currency?: string;
    referenceDate?: Date;
  }
): Promise<DenisOwnerRoiDashboard> {
  const reference = input.referenceDate ?? new Date();
  const period = monthBounds(reference);
  const monthStartDate = period.start.slice(0, 10);

  const [
    eventRows,
    { data: experienceRows },
    { data: monthlyExperience },
    { data: feedbackRows },
  ] = await Promise.all([
    loadDenisRoiEventsForRange(admin, {
      locationId: input.locationId,
      fromIso: period.start,
      toIso: period.end,
    }),
    admin
      .from("experience_analytics_daily")
      .select("upsell_revenue_total, by_nudge_revenue, t0_turns, llm_turns, by_roi_impact")
      .eq("location_id", input.locationId)
      .gte("metric_date", monthStartDate),
    admin
      .from("experience_analytics_daily")
      .select("metric_date, upsell_revenue_total")
      .eq("location_id", input.locationId)
      .gte(
        "metric_date",
        new Date(reference.getFullYear(), reference.getMonth() - 5, 1)
          .toISOString()
          .slice(0, 10)
      ),
    admin
      .from("order_feedback")
      .select("rating")
      .eq("location_id", input.locationId)
      .gte("created_at", period.start)
      .lte("created_at", period.end),
  ]);

  const metrics = aggregateDenisRoiMetrics(eventRows);

  const nudgeMerged: Record<string, { accepted: number; revenue: number }> = {};
  let rollupUpsellCents = 0;
  let rollupConversations = 0;
  let rollupAllergy = 0;

  for (const row of experienceRows ?? []) {
    const daily = row as {
      upsell_revenue_total: number;
      by_nudge_revenue: Record<string, { accepted?: number; revenue?: number }>;
      t0_turns: number;
      llm_turns: number;
      by_roi_impact?: { allergy_catches?: number };
    };
    rollupUpsellCents += Math.round(Number(daily.upsell_revenue_total ?? 0) * 100);
    rollupConversations += (daily.t0_turns ?? 0) + (daily.llm_turns ?? 0);
    rollupAllergy += daily.by_roi_impact?.allergy_catches ?? 0;
    for (const [key, stats] of Object.entries(daily.by_nudge_revenue ?? {})) {
      const existing = nudgeMerged[key] ?? { accepted: 0, revenue: 0 };
      nudgeMerged[key] = {
        accepted: existing.accepted + (stats.accepted ?? 0),
        revenue: existing.revenue + Number(stats.revenue ?? 0),
      };
    }
  }

  if (metrics.upsellAccepted === 0 && rollupUpsellCents > 0) {
    metrics.upsellRevenueCents = rollupUpsellCents;
  }
  if (metrics.denisConversations === 0 && rollupConversations > 0) {
    metrics.denisConversations = rollupConversations;
    metrics.estimatedMinutesSaved =
      rollupConversations * MINUTES_SAVED_PER_CONVERSATION;
  }
  if (metrics.allergyWarnings + metrics.allergyBlocks === 0 && rollupAllergy > 0) {
    metrics.allergyWarnings = rollupAllergy;
  }

  const ratings = (feedbackRows ?? [])
    .map((row) => Number((row as { rating: number }).rating))
    .filter((rating) => Number.isFinite(rating) && rating > 0);
  metrics.avgGuestRating =
    ratings.length > 0
      ? Math.round(
          (ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10
        ) / 10
      : 0;

  const planCostEuros = fromCents(input.planPriceCents);
  const totalDenisRevenueEuros = totalDenisAttributedRevenueEuros(metrics);
  const roi = computeBillingRoiJustification({
    upsellRevenueEuros: totalDenisRevenueEuros,
    planCostEuros,
    currency: input.currency,
  });

  const tier = getPlanTierDefinition(input.planId);
  const monthlyBuckets = new Map<string, number>();
  for (const row of monthlyExperience ?? []) {
    const daily = row as { metric_date: string; upsell_revenue_total: number };
    const monthKey = daily.metric_date.slice(0, 7);
    monthlyBuckets.set(
      monthKey,
      (monthlyBuckets.get(monthKey) ?? 0) + Number(daily.upsell_revenue_total ?? 0)
    );
  }

  const monthlyTrend = [...monthlyBuckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenueEuros]) => ({
      month,
      revenueEuros: Math.round(revenueEuros * 100) / 100,
      roiMultiplier:
        planCostEuros > 0
          ? Math.round((revenueEuros / planCostEuros) * 10) / 10
          : 0,
    }));

  return {
    period: {
      monthLabel: period.monthLabel,
      start: monthStartDate,
      end: period.end.slice(0, 10),
    },
    metrics,
    plan: {
      id: input.planId,
      displayName: displayPlanName(input.planId),
      costEuros: planCostEuros,
    },
    totalDenisRevenueEuros,
    roi,
    monthlyTrend,
    topContributions: buildTopDenisContributions(
      metrics,
      mergeNudgeBreakdown(nudgeMerged)
    ),
  };
}

export type WeeklyDenisRoiDigestInput = {
  metrics: DenisRoiMetrics;
  planCostEuros: number;
  language: string;
  currency?: string;
};

export function formatWeeklyDenisRoiDigest(
  input: WeeklyDenisRoiDigestInput
): string[] {
  const lang = input.language.slice(0, 2).toLowerCase();
  const sym = input.currency === "EUR" || !input.currency ? "€" : input.currency;
  const hours =
    Math.round((input.metrics.estimatedMinutesSaved / 60) * 10) / 10;
  const upsellEuros = Math.round(input.metrics.upsellRevenueCents) / 100;
  const winBackEuros = Math.round(input.metrics.winBackRevenueCents) / 100;
  const totalRevenue = upsellEuros + winBackEuros;
  const roiMultiplier =
    input.planCostEuros > 0
      ? Math.round((totalRevenue / input.planCostEuros) * 10) / 10
      : 0;
  const allergyIncidents =
    input.metrics.allergyWarnings + input.metrics.allergyBlocks;

  if (lang === "de") {
    return [
      "Denis Wochenbericht:",
      `- Denis führte ${input.metrics.denisConversations} Gespräche (≈ ${hours}h Kellnerzeit gespart)`,
      `- Upsell ${input.metrics.upsellAccepted}× angenommen (${sym}${upsellEuros.toLocaleString("de-DE")})`,
      `- ${input.metrics.winBackReturned} Win-back Gäste zurück (${sym}${winBackEuros.toLocaleString("de-DE")})`,
      allergyIncidents > 0
        ? `- ${allergyIncidents} Allergen-Vorfälle verhindert`
        : "",
      `- Ihr Plan kostet ${sym}${input.planCostEuros.toLocaleString("de-DE")}/Monat — ROI: ${roiMultiplier}x`,
    ].filter(Boolean);
  }

  if (lang === "en") {
    return [
      "Weekly Denis report:",
      `- Denis handled ${input.metrics.denisConversations} conversations (saved ≈ ${hours}h waiter time)`,
      `- Upsell accepted ${input.metrics.upsellAccepted} times (${sym}${upsellEuros.toLocaleString("en-US")})`,
      `- ${input.metrics.winBackReturned} win-back guests returned (${sym}${winBackEuros.toLocaleString("en-US")})`,
      allergyIncidents > 0
        ? `- ${allergyIncidents} allergen incidents prevented`
        : "",
      `- Your plan costs ${sym}${input.planCostEuros.toLocaleString("en-US")}/month — ROI: ${roiMultiplier}x`,
    ].filter(Boolean);
  }

  return [
    "Ovonedeljni Denis izveštaj:",
    `- Denis je vodio ${input.metrics.denisConversations} razgovora (sačuvao ${hours}h konobaru)`,
    `- Upsell prihvaćen ${input.metrics.upsellAccepted} puta (${sym}${upsellEuros.toLocaleString("sr-RS")})`,
    `- ${input.metrics.winBackReturned} win-back gosta se vratila (${sym}${winBackEuros.toLocaleString("sr-RS")})`,
    allergyIncidents > 0
      ? `- ${allergyIncidents} alergen incident sprečen`
      : "",
    `- Vaš plan košta ${sym}${input.planCostEuros.toLocaleString("sr-RS")}/mesec — ROI: ${roiMultiplier}x`,
  ].filter(Boolean);
}
