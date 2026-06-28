import { describe, expect, it } from "vitest";
import { buildSituationPack } from "@/lib/denis/cognition/context/build-situation-pack";
import { beliefGraph } from "@/lib/denis/cognition/beliefs/belief-types";
import { formatVenueKnowledgeBlock } from "@/lib/denis/cognition/manifest/inject-venue-knowledge";
import {
  accumulateVenueKnowledge,
  mergeRhythmPriorsIntoVenueKnowledge,
  resolvePeakBehaviorFromVenueKnowledge,
  resolveVenueKnowledgeAutoPair,
} from "@/lib/denis/learning/venue-knowledge-accumulator";
import {
  applyRetentionPolicyToSnapshot,
  classifyRetentionTier,
  partitionOrderRowsByRetention,
  VENUE_KNOWLEDGE_FULL_DETAIL_DAYS,
} from "@/lib/denis/learning/venue-knowledge-retention";
import type { VenueKnowledgeOrderRow } from "@/lib/denis/learning/venue-knowledge-types";
import { buildPeakHourKnowledgeFromForecast, forecastDemand } from "@/lib/denis/intelligence/demand-forecast";
import { trendingProductsToKnowledgeHints } from "@/lib/denis/intelligence/load-trending-menu-products";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";

const NOW = new Date("2026-06-28T12:00:00.000Z");
const BURGER_ID = "burger-id";
const FRIES_ID = "fries-id";

function buildBurgerFriesOrders(count: number, pairRate = 0.8): VenueKnowledgeOrderRow[] {
  const rows: VenueKnowledgeOrderRow[] = [];
  for (let session = 0; session < count; session += 1) {
    const createdAt = new Date(NOW.getTime() - session * 3_600_000).toISOString();
    rows.push({
      tableSessionId: `session-${session}`,
      productId: BURGER_ID,
      productName: "Burger",
      menuSection: "food",
      createdAt,
    });
    if (session / count < pairRate) {
      rows.push({
        tableSessionId: `session-${session}`,
        productId: FRIES_ID,
        productName: "Pomfrit",
        menuSection: "food",
        createdAt,
      });
    }
  }
  return rows;
}

describe("venue knowledge accumulator", () => {
  it("learns burger → pomfrit auto-pair from 100 orders at 80%", () => {
    const rows = buildBurgerFriesOrders(100, 0.8);
    const knowledge = accumulateVenueKnowledge({ orderRows: rows, now: NOW });

    const autoPair = resolveVenueKnowledgeAutoPair(knowledge, BURGER_ID);
    expect(autoPair).not.toBeNull();
    expect(autoPair?.pairedProductName).toBe("Pomfrit");
    expect(autoPair?.pairRatePct).toBeGreaterThanOrEqual(70);

    const block = formatVenueKnowledgeBlock(knowledge);
    expect(block).toContain("auto-pair: Burger → Pomfrit");
  });

  it("applies peak friday rush → short mode behavior", () => {
    const priors: LocationRhythmPriorsJson = {
      version: 1,
      slots: {
        "5:19": {
          sampleSessions: 40,
          sessionDurationP50Min: 45,
          dessertDelayP50Min: 12,
          revenueEma: 420,
          topProducts: [],
          servicePeriod: "dinner",
        },
        "5:20": {
          sampleSessions: 38,
          sessionDurationP50Min: 42,
          dessertDelayP50Min: 10,
          revenueEma: 400,
          topProducts: [],
          servicePeriod: "dinner",
        },
        "2:14": {
          sampleSessions: 2,
          sessionDurationP50Min: 70,
          dessertDelayP50Min: null,
          revenueEma: 80,
          topProducts: [],
          servicePeriod: "lunch",
        },
      },
    };

    const base = accumulateVenueKnowledge({ orderRows: [], now: NOW });
    const knowledge = mergeRhythmPriorsIntoVenueKnowledge(base, priors);

    const fridayBehavior = resolvePeakBehaviorFromVenueKnowledge(knowledge, 5, 19);
    expect(fridayBehavior?.shortenReplies).toBe(true);
    expect(fridayBehavior?.skipUpsell).toBe(true);

    const tuesdayBehavior = resolvePeakBehaviorFromVenueKnowledge(knowledge, 2, 14);
    expect(tuesdayBehavior?.shortenReplies).toBe(false);
    expect(tuesdayBehavior?.upsellLevel).toBe("full");
  });

  it("aggregates data older than 90 days (not full detail)", () => {
    const recent = buildBurgerFriesOrders(20, 0.8);
    const oldCreatedAt = new Date(
      NOW.getTime() - (VENUE_KNOWLEDGE_FULL_DETAIL_DAYS + 5) * 86_400_000
    ).toISOString();
    const oldRows: VenueKnowledgeOrderRow[] = [
      {
        tableSessionId: "old-session",
        productId: "schnitzel-id",
        productName: "Schnitzel",
        menuSection: "food",
        createdAt: oldCreatedAt,
      },
    ];

    const partitioned = partitionOrderRowsByRetention(
      [...recent, ...oldRows],
      NOW
    );
    expect(classifyRetentionTier(partitioned.oldestAgeDays)).toBe("aggregated");

    const knowledge = accumulateVenueKnowledge({
      orderRows: [...recent, ...oldRows],
      now: NOW,
    });
    expect(knowledge.retentionTier).toBe("aggregated");

    const stripped = applyRetentionPolicyToSnapshot(knowledge, "aggregated");
    expect(stripped.itemPairLearnings.length).toBeLessThanOrEqual(12);
    expect(stripped.retentionTier).toBe("aggregated");
  });

  it("tracks guest language distribution for default greeting", () => {
    const knowledge = accumulateVenueKnowledge({
      orderRows: [],
      sessionLanguages: ["de", "de", "de", "de", "de", "de", "de", "en", "en", "sr"],
      now: NOW,
    });

    expect(knowledge.defaultGreetingLanguage).toBe("de");
    expect(knowledge.languageDistribution[0]?.sharePct).toBe(70);
  });

  it("injects venue knowledge block into situation pack", () => {
    const knowledge = accumulateVenueKnowledge({
      orderRows: buildBurgerFriesOrders(100, 0.82),
      sessionLanguages: ["de", "de", "de"],
      now: NOW,
    });

    const pack = buildSituationPack({
      beliefs: beliefGraph([]),
      venueKnowledge: knowledge,
    });

    expect(pack).toContain("VENUE KNOWLEDGE");
    expect(pack).toContain("Burger → Pomfrit");
  });
});

describe("venue knowledge intelligence hooks", () => {
  it("maps trending products to knowledge hints", () => {
    const hints = trendingProductsToKnowledgeHints({
      trending: {
        productIds: ["a", "b"],
        orderCountsToday: { a: 12, b: 8 },
      },
      productNames: { a: "Schnitzel", b: "Burger" },
    });

    expect(hints[0]?.productName).toBe("Schnitzel");
    expect(hints[0]?.orderCountToday).toBe(12);
  });

  it("maps demand forecast peaks to rhythm slot hints", () => {
    const orders = Array.from({ length: 40 }, (_, index) => ({
      productId: "burger-id",
      productName: "Burger",
      quantity: 2,
      createdAt: new Date(Date.UTC(2026, 5, index % 28, 19, 0)).toISOString(),
    }));

    const forecast = forecastDemand({
      date: "2026-06-28",
      historicalOrders: orders,
      dayOfWeek: 5,
      minHistoryDays: 1,
    });

    const slots = buildPeakHourKnowledgeFromForecast(forecast);
    expect(Object.keys(slots).length).toBeGreaterThan(0);
  });
});
