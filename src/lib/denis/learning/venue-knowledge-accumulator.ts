import { computeBasketPairs } from "@/lib/denis/config/basket-pair-analysis";
import type { HistoricalOrderRow } from "@/lib/denis/config/basket-pair-types";
import {
  computeRushIndex,
  medianSlotSessions,
} from "@/lib/denis/config/evaluate-rhythm-ops-alerts";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import {
  resolveRhythmBehaviorDirectives,
  rhythmSlotKey,
  slotStressFromRushIndex,
} from "@/lib/denis/config/resolve-rhythm-priors";
import {
  applyRetentionPolicyToSnapshot,
  classifyRetentionTier,
  partitionOrderRowsByRetention,
} from "@/lib/denis/learning/venue-knowledge-retention";
import type {
  VenueDrinkMix,
  VenueItemPairLearning,
  VenueKnowledgeSnapshot,
  VenueModifierLearning,
  VenuePeakHourProfile,
  VenueTasteProfile,
} from "@/lib/denis/platform/venue-knowledge-types";
import type {
  VenueKnowledgeAccumulateInput,
  VenueKnowledgeOrderRow,
} from "@/lib/denis/learning/venue-knowledge-types";

const BEER_PATTERN =
  /\b(pilsner|lager|weizen|radler|pivo|beer|ipa|stout|ale|porter)\b/i;
const WINE_PATTERN =
  /\b(riesling|sauvignon|chardonnay|pinot|vino|wine|prosecco|šampanjac|champagne|crveno|belo)\b/i;
const COCKTAIL_PATTERN =
  /\b(cocktail|spritz|aperol|negroni|mojito|margarita|martini|gin tonic|g&t)\b/i;
const DESSERT_PATTERN =
  /\b(torta|cake|desert|dessert|pala[cč]inke|pancake|ice cream|sladoled|tiramisu|cheesecake)\b/i;

const WEEKDAY_LABELS = [
  "Nedelja",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
];

const AUTO_PAIR_MIN_RATE_PCT = 70;
const AUTO_PAIR_MIN_SESSIONS = 10;
const MODIFIER_MIN_ORDERS = 20;
const MODIFIER_MIN_RATE_PCT = 30;

function resolveSlotStress(
  sampleSessions: number,
  medianSessions: number
): ReturnType<typeof slotStressFromRushIndex> {
  if (sampleSessions >= 25) return "rush";
  if (sampleSessions >= 12) return "busy";
  const rushIndex = computeRushIndex(sampleSessions, Math.max(1, medianSessions));
  const indexed = slotStressFromRushIndex(rushIndex);
  if (indexed !== "normal") return indexed;
  if (sampleSessions <= 3) return "low";
  return "normal";
}

function normalizeLang(code: string): string {
  return code.trim().toLowerCase().slice(0, 2) || "sr";
}

function classifyDrinkCategory(productName: string, menuSection?: string | null) {
  const section = (menuSection ?? "").toLowerCase();
  const name = productName.trim();
  if (section.includes("drink") || section.includes("bar")) {
    if (BEER_PATTERN.test(name)) return "beer";
    if (WINE_PATTERN.test(name)) return "wine";
    if (COCKTAIL_PATTERN.test(name)) return "cocktail";
    return "other";
  }
  if (BEER_PATTERN.test(name)) return "beer";
  if (WINE_PATTERN.test(name)) return "wine";
  if (COCKTAIL_PATTERN.test(name)) return "cocktail";
  return "other";
}

function isDessert(row: VenueKnowledgeOrderRow): boolean {
  const section = (row.menuSection ?? "").toLowerCase();
  if (section.includes("dessert")) return true;
  return DESSERT_PATTERN.test(row.productName);
}

function toHistoricalRows(rows: VenueKnowledgeOrderRow[]): HistoricalOrderRow[] {
  return rows.map((row) => ({
    tableSessionId: row.tableSessionId,
    productId: row.productId,
    productName: row.productName,
  }));
}

function computeDrinkMix(rows: VenueKnowledgeOrderRow[]): VenueDrinkMix {
  const counts = { beer: 0, wine: 0, cocktail: 0, other: 0 };
  for (const row of rows) {
    const category = classifyDrinkCategory(row.productName, row.menuSection);
    if (category === "beer") counts.beer += 1;
    else if (category === "wine") counts.wine += 1;
    else if (category === "cocktail") counts.cocktail += 1;
    else counts.other += 1;
  }
  const total = counts.beer + counts.wine + counts.cocktail + counts.other;
  if (total <= 0) {
    return { beer: 0, wine: 0, cocktail: 0, other: 0 };
  }
  return {
    beer: Math.round((counts.beer / total) * 100),
    wine: Math.round((counts.wine / total) * 100),
    cocktail: Math.round((counts.cocktail / total) * 100),
    other: Math.round((counts.other / total) * 100),
  };
}

function computeTopItemByDow(rows: VenueKnowledgeOrderRow[]): Record<string, string> {
  const byDow = new Map<number, Map<string, number>>();

  for (const row of rows) {
    const created = new Date(row.createdAt);
    const dow = created.getUTCDay();
    const name = row.productName.trim();
    if (!name) continue;
    let bucket = byDow.get(dow);
    if (!bucket) {
      bucket = new Map();
      byDow.set(dow, bucket);
    }
    bucket.set(name, (bucket.get(name) ?? 0) + 1);
  }

  const result: Record<string, string> = {};
  for (const [dow, counts] of byDow) {
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top?.[0]) result[String(dow)] = top[0];
  }
  return result;
}

function computeWeekendDessertLift(rows: VenueKnowledgeOrderRow[]): Pick<
  VenueTasteProfile,
  "weekendDessertSharePct" | "weekdayDessertSharePct" | "weekendDessertLiftPct"
> {
  const sessions = new Map<string, { dow: number; hasDessert: boolean }>();

  for (const row of rows) {
    const sessionId = row.tableSessionId.trim();
    if (!sessionId) continue;
    const created = new Date(row.createdAt);
    const dow = created.getUTCDay();
    const existing = sessions.get(sessionId);
    if (!existing) {
      sessions.set(sessionId, { dow, hasDessert: isDessert(row) });
    } else if (isDessert(row)) {
      existing.hasDessert = true;
    }
  }

  let weekendTotal = 0;
  let weekendDessert = 0;
  let weekdayTotal = 0;
  let weekdayDessert = 0;

  for (const session of sessions.values()) {
    const isWeekend = session.dow === 0 || session.dow === 6;
    if (isWeekend) {
      weekendTotal += 1;
      if (session.hasDessert) weekendDessert += 1;
    } else {
      weekdayTotal += 1;
      if (session.hasDessert) weekdayDessert += 1;
    }
  }

  const weekendDessertSharePct =
    weekendTotal > 0 ? Math.round((weekendDessert / weekendTotal) * 100) : null;
  const weekdayDessertSharePct =
    weekdayTotal > 0 ? Math.round((weekdayDessert / weekdayTotal) * 100) : null;
  const weekendDessertLiftPct =
    weekdayDessertSharePct != null &&
    weekdayDessertSharePct > 0 &&
    weekendDessertSharePct != null
      ? Math.round(
          ((weekendDessertSharePct - weekdayDessertSharePct) /
            weekdayDessertSharePct) *
            100
        )
      : null;

  return { weekendDessertSharePct, weekdayDessertSharePct, weekendDessertLiftPct };
}

function computeLanguageDistribution(sessionLanguages: string[]) {
  const counts = new Map<string, number>();
  for (const raw of sessionLanguages) {
    const code = normalizeLang(raw);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total <= 0) return [];

  return [...counts.entries()]
    .map(([code, sessionCount]) => ({
      code,
      sessionCount,
      sharePct: Math.round((sessionCount / total) * 100),
    }))
    .sort((a, b) => b.sharePct - a.sharePct);
}

function computeItemPairLearnings(
  rows: VenueKnowledgeOrderRow[]
): VenueItemPairLearning[] {
  const pairs = computeBasketPairs(toHistoricalRows(rows), {
    minSampleSessions: AUTO_PAIR_MIN_SESSIONS,
  });

  return pairs.slice(0, 20).map((pair) => ({
    anchorProductId: pair.productA,
    anchorProductName: pair.productAName,
    pairedProductId: pair.productB,
    pairedProductName: pair.productBName,
    pairRatePct: pair.confidencePercent,
    sampleSessions: pair.sampleSessions,
  }));
}

function computeModifierLearnings(
  rows: VenueKnowledgeOrderRow[]
): VenueModifierLearning[] {
  const byProduct = new Map<
    string,
    { productName: string; orders: number; modifiers: Map<string, number> }
  >();

  for (const row of rows) {
    const productId = row.productId.trim();
    if (!productId) continue;
    let bucket = byProduct.get(productId);
    if (!bucket) {
      bucket = { productName: row.productName, orders: 0, modifiers: new Map() };
      byProduct.set(productId, bucket);
    }
    bucket.orders += 1;

    for (const modifier of row.modifierNames ?? []) {
      const label = modifier.trim();
      if (!label) continue;
      bucket.modifiers.set(label, (bucket.modifiers.get(label) ?? 0) + 1);
    }

    const note = row.notes?.trim() ?? "";
    if (/extra\s+sos|dodatni\s+sos|extra\s+sauce|mehr\s+soße/i.test(note)) {
      bucket.modifiers.set(
        "extra sos",
        (bucket.modifiers.get("extra sos") ?? 0) + 1
      );
    }
  }

  const learnings: VenueModifierLearning[] = [];
  for (const [productId, bucket] of byProduct) {
    if (bucket.orders < MODIFIER_MIN_ORDERS) continue;
    for (const [modifierLabel, count] of bucket.modifiers) {
      const requestRatePct = Math.round((count / bucket.orders) * 100);
      if (requestRatePct < MODIFIER_MIN_RATE_PCT) continue;
      learnings.push({
        productId,
        productName: bucket.productName,
        modifierLabel,
        requestRatePct,
        sampleOrders: bucket.orders,
      });
    }
  }

  return learnings.sort(
    (a, b) => b.requestRatePct - a.requestRatePct || b.sampleOrders - a.sampleOrders
  );
}

function buildPeakProfiles(input: {
  rhythmPriors?: LocationRhythmPriorsJson | null;
  rhythmSlotSessions?: VenueKnowledgeAccumulateInput["rhythmSlotSessions"];
}): VenuePeakHourProfile[] {
  const profiles: VenuePeakHourProfile[] = [];
  const slotEntries = input.rhythmPriors?.slots ?? {};
  const merged = new Map<
    string,
    { sampleSessions: number; avgWaitMinutes: number | null }
  >();

  for (const [slotKey, slot] of Object.entries(slotEntries)) {
    merged.set(slotKey, {
      sampleSessions: slot.sampleSessions,
      avgWaitMinutes: null,
    });
  }

  for (const [slotKey, stats] of Object.entries(input.rhythmSlotSessions ?? {})) {
    merged.set(slotKey, {
      sampleSessions: stats.sampleSessions,
      avgWaitMinutes: stats.avgWaitMinutes ?? null,
    });
  }

  const priorsForMedian: LocationRhythmPriorsJson = {
    version: 1,
    slots: Object.fromEntries(
      [...merged.entries()].map(([slotKey, stats]) => [
        slotKey,
        {
          sampleSessions: stats.sampleSessions,
          sessionDurationP50Min: null,
          dessertDelayP50Min: null,
          revenueEma: null,
          topProducts: [],
          servicePeriod: "dinner" as const,
        },
      ])
    ),
  };
  const medianSessions = Math.max(1, medianSlotSessions(priorsForMedian));

  for (const [slotKey, stats] of merged) {
    if (stats.sampleSessions <= 0) continue;
    const [dowRaw, hourRaw] = slotKey.split(":");
    const dayOfWeek = Number(dowRaw);
    const hour = Number(hourRaw);
    if (!Number.isFinite(dayOfWeek) || !Number.isFinite(hour)) continue;

    const stress = resolveSlotStress(stats.sampleSessions, medianSessions);
    const slotPrior = slotEntries[slotKey];
    const servicePeriod = slotPrior?.servicePeriod ?? "dinner";
    const behavior = resolveRhythmBehaviorDirectives(stress, servicePeriod);
    const dayLabel = WEEKDAY_LABELS[dayOfWeek] ?? "Slot";

    profiles.push({
      slotKey,
      dayOfWeek,
      hour,
      avgWaitMinutes: stats.avgWaitMinutes,
      stress:
        stress === "rush" || stress === "high"
          ? "rush"
          : stress === "busy"
            ? "busy"
            : stress === "low"
              ? "low"
              : "normal",
      behavior,
      label: `${dayLabel} ${hour}:00`,
    });
  }

  return profiles.sort((a, b) => {
    const aSessions = merged.get(a.slotKey)?.sampleSessions ?? 0;
    const bSessions = merged.get(b.slotKey)?.sampleSessions ?? 0;
    return bSessions - aSessions;
  });
}

/** Main venue knowledge accumulator — GDPR-safe aggregates only. */
export function accumulateVenueKnowledge(
  input: VenueKnowledgeAccumulateInput
): VenueKnowledgeSnapshot {
  const now = input.now ?? new Date();
  const partitioned = partitionOrderRowsByRetention(input.orderRows, now);
  const activeRows =
    partitioned.full.length > 0
      ? partitioned.full
      : partitioned.aggregated.length > 0
        ? partitioned.aggregated
        : partitioned.trend;

  const drinkMix = computeDrinkMix(activeRows.filter((row) => {
    const section = (row.menuSection ?? "").toLowerCase();
    return section.includes("drink") || section.includes("bar") || classifyDrinkCategory(row.productName, row.menuSection) !== "other";
  }));

  const tasteProfile: VenueTasteProfile = {
    drinkMix,
    topItemByDow: computeTopItemByDow(activeRows),
    ...computeWeekendDessertLift(activeRows),
  };

  const languageDistribution = computeLanguageDistribution(
    input.sessionLanguages ?? []
  );
  const defaultGreetingLanguage =
    languageDistribution[0]?.code ?? "sr";

  const snapshot: VenueKnowledgeSnapshot = {
    version: 1,
    computedAt: now.toISOString(),
    retentionTier: classifyRetentionTier(partitioned.oldestAgeDays),
    orderSampleCount: activeRows.length,
    tasteProfile,
    languageDistribution,
    defaultGreetingLanguage,
    peakHourProfiles: buildPeakProfiles({
      rhythmSlotSessions: input.rhythmSlotSessions,
    }),
    itemPairLearnings: computeItemPairLearnings(activeRows),
    modifierLearnings: computeModifierLearnings(activeRows),
  };

  return applyRetentionPolicyToSnapshot(
    snapshot,
    snapshot.retentionTier
  );
}

export function mergeRhythmPriorsIntoVenueKnowledge(
  snapshot: VenueKnowledgeSnapshot,
  priors: LocationRhythmPriorsJson
): VenueKnowledgeSnapshot {
  return {
    ...snapshot,
    peakHourProfiles: buildPeakProfiles({ rhythmPriors: priors }),
  };
}

export function resolveVenueKnowledgeAutoPair(
  snapshot: VenueKnowledgeSnapshot,
  anchorProductId: string
): VenueItemPairLearning | null {
  const match = snapshot.itemPairLearnings.find(
    (row) =>
      row.anchorProductId === anchorProductId &&
      row.pairRatePct >= AUTO_PAIR_MIN_RATE_PCT
  );
  return match ?? null;
}

export function resolvePeakBehaviorFromVenueKnowledge(
  snapshot: VenueKnowledgeSnapshot,
  dayOfWeek: number,
  hour: number
): VenuePeakHourProfile["behavior"] | null {
  const slotKey = rhythmSlotKey(dayOfWeek, hour);
  const profile = snapshot.peakHourProfiles.find((row) => row.slotKey === slotKey);
  return profile?.behavior ?? null;
}

export {
  AUTO_PAIR_MIN_RATE_PCT,
  AUTO_PAIR_MIN_SESSIONS,
};
