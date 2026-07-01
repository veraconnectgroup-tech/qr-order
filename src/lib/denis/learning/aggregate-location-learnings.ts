import type { DenisTimelineRow } from "@/lib/denis/platform/timeline-types";
import { computeBasketPairs } from "@/lib/denis/config/basket-pair-analysis";
import type { HistoricalOrderRow } from "@/lib/denis/config/basket-pair-types";

export type MenuGapLearningAggregate = {
  term: string;
  count: number;
  lastSeenAt: string;
  suggestMenuAdd: boolean;
};

export type LocationLearningsAggregate = {
  menuGap: MenuGapLearningAggregate[];
  priceResistance: { count: number };
  allergyCoverage: { count: number };
  languageUnsupported: { count: number; detected: string[] };
  popularPairing: Array<{
    fromProductName: string;
    toProductName: string;
    sessionCount: number;
  }>;
  peakHourBottleneck: Array<{ hour: number; lateSignals: number }>;
  dessertConversion: {
    nudged: number;
    converted: number;
    rate: number;
  };
  upsellSuccessRate: {
    attempts: number;
    accepts: number;
    rate: number;
  };
};

const MENU_GAP_SUGGEST_THRESHOLD = 5;

function asRecord(payload: DenisTimelineRow["payload"]): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function hourUtc(iso: string): number {
  return new Date(iso).getUTCHours();
}

/** Fold operator-facing learning aggregates from Denis timelines (+ optional order rows). */
export function aggregateLocationLearnings(input: {
  timeline: DenisTimelineRow[];
  orderRows?: HistoricalOrderRow[];
}): LocationLearningsAggregate {
  const menuGapCounts = new Map<string, { count: number; lastSeenAt: string }>();
  let priceResistance = 0;
  let allergyCoverage = 0;
  const unsupportedLanguages = new Set<string>();
  let languageUnsupported = 0;

  let dessertNudged = 0;
  let dessertConverted = 0;
  let upsellAttempts = 0;
  let upsellAccepts = 0;
  const peakByHour = new Map<number, number>();

  for (const row of input.timeline) {
    const payload = asRecord(row.payload);

    if (row.event_type === "learning.menu_gap") {
      const term = readString(payload.term);
      if (!term) continue;
      const key = term.toLowerCase();
      const prev = menuGapCounts.get(key);
      menuGapCounts.set(key, {
        count: (prev?.count ?? 0) + 1,
        lastSeenAt: row.created_at,
      });
      continue;
    }

    if (row.event_type === "learning.price_resistance") {
      priceResistance += 1;
      continue;
    }

    if (row.event_type === "learning.allergy_coverage") {
      allergyCoverage += 1;
      continue;
    }

    if (row.event_type === "learning.language_unsupported") {
      languageUnsupported += 1;
      const detected = readString(payload.detected);
      if (detected) unsupportedLanguages.add(detected);
      continue;
    }

    if (row.event_type === "proactive.emitted") {
      const kind = readString(payload.kind);
      if (kind === "dessert_nudge") dessertNudged += 1;
      if (
        kind === "drink_with_food" ||
        kind === "drink_refill" ||
        kind === "drink_pairing" ||
        kind === "round_two" ||
        kind === "happy_hour_upsell"
      ) {
        upsellAttempts += 1;
      }
      continue;
    }

    if (row.event_type === "anticipation.resolved") {
      const outcome = readString(payload.outcome);
      const kind = readString(payload.nudgeKind);
      if (outcome === "accepted" && kind === "dessert_nudge") {
        dessertConverted += 1;
      }
      if (
        outcome === "accepted" &&
        kind &&
        ["drink_with_food", "drink_refill", "drink_pairing", "round_two"].includes(kind)
      ) {
        upsellAccepts += 1;
      }
      continue;
    }

    if (
      row.event_type === "offer.converted" &&
      readString(asRecord(row.payload).nudgeKind)
    ) {
      upsellAccepts += 1;
      continue;
    }

    if (
      row.event_type === "proactive.emitted" &&
      (readString(payload.kind) === "slow_kitchen" ||
        readString(payload.kind) === "order_eta_update")
    ) {
      const hour = hourUtc(row.created_at);
      peakByHour.set(hour, (peakByHour.get(hour) ?? 0) + 1);
    }
  }

  const menuGap = [...menuGapCounts.entries()]
    .map(([term, stats]) => ({
      term,
      count: stats.count,
      lastSeenAt: stats.lastSeenAt,
      suggestMenuAdd: stats.count >= MENU_GAP_SUGGEST_THRESHOLD,
    }))
    .sort((a, b) => b.count - a.count);

  const pairs = computeBasketPairs(input.orderRows ?? [], {
    minSampleSessions: 2,
  }).slice(0, 5);

  const peakHourBottleneck = [...peakByHour.entries()]
    .map(([hour, lateSignals]) => ({ hour, lateSignals }))
    .sort((a, b) => b.lateSignals - a.lateSignals)
    .slice(0, 5);

  return {
    menuGap,
    priceResistance: { count: priceResistance },
    allergyCoverage: { count: allergyCoverage },
    languageUnsupported: {
      count: languageUnsupported,
      detected: [...unsupportedLanguages],
    },
    popularPairing: pairs.map((pair) => ({
      fromProductName: pair.productAName,
      toProductName: pair.productBName,
      sessionCount: pair.sampleSessions,
    })),
    peakHourBottleneck,
    dessertConversion: {
      nudged: dessertNudged,
      converted: dessertConverted,
      rate: dessertNudged > 0 ? dessertConverted / dessertNudged : 0,
    },
    upsellSuccessRate: {
      attempts: upsellAttempts,
      accepts: upsellAccepts,
      rate: upsellAttempts > 0 ? upsellAccepts / upsellAttempts : 0,
    },
  };
}
