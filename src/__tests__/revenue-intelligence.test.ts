import { describe, expect, it } from "vitest";
import { decideProactiveTurnPlan } from "@/lib/denis/cognition/proactive/decide-proactive-turn-plan";
import {
  computeRevenueInsight,
  computeSessionCheckEuros,
  deriveCheckTier,
  formatRevenueInsightEvidence,
  revenueCheckTierPriorityBoost,
  revenueStrategyPriorityBoost,
  shouldOfferFoodUpsellForRevenue,
  shouldSkipDessertForRevenueStrategy,
  staffCopilotRevenueHint,
  staffCopilotTableRevenueHint,
} from "@/lib/denis/config/revenue-intelligence";
import {
  buildDailyRevenueIntelligenceReport,
  formatDailyRevenueIntelligenceLines,
  identifyLowPerformingTableLabels,
} from "@/lib/denis/learning/revenue-intelligence";
import { rhythmSlotKey } from "@/lib/denis/config/resolve-rhythm-priors";
import type { LocationRhythmPriorsJson } from "@/lib/denis/config/rhythm-prior-types";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

function slotPrior(input: {
  sampleSessions: number;
  revenueEma: number;
  sessionDurationP50Min: number;
  dessertDelayP50Min?: number;
}) {
  return {
    sampleSessions: input.sampleSessions,
    sessionDurationP50Min: input.sessionDurationP50Min,
    dessertDelayP50Min: input.dessertDelayP50Min ?? 22,
    revenueEma: input.revenueEma,
    topProducts: [],
    servicePeriod: "dinner" as const,
  };
}

describe("computeRevenueInsight H2", () => {
  const rushSlot = rhythmSlotKey(5, 21);
  const slowSlot = rhythmSlotKey(2, 15);

  const priors: LocationRhythmPriorsJson = {
    version: 1,
    slots: {
      [rushSlot]: slotPrior({
        sampleSessions: 20,
        revenueEma: 4000,
        sessionDurationP50Min: 45,
        dessertDelayP50Min: 18,
      }),
      [slowSlot]: slotPrior({
        sampleSessions: 16,
        revenueEma: 1200,
        sessionDurationP50Min: 70,
        dessertDelayP50Min: 28,
      }),
      [rhythmSlotKey(5, 20)]: slotPrior({
        sampleSessions: 12,
        revenueEma: 2500,
        sessionDurationP50Min: 50,
      }),
    },
  };

  it("selects turnover for rush slot stress", () => {
    const insight = computeRevenueInsight(priors, rushSlot, 40, {
      currentSlotStress: "rush",
    });
    expect(insight.strategy).toBe("turnover");
    expect(shouldSkipDessertForRevenueStrategy(insight.strategy)).toBe(true);
  });

  it("selects check_size for slow underperforming slot", () => {
    const insight = computeRevenueInsight(priors, slowSlot, 40);
    expect(insight.strategy).toBe("check_size");
    expect(insight.currentSlotRevPASH).not.toBeNull();
    expect(insight.targetRevPASH).not.toBeNull();
    if (insight.currentSlotRevPASH != null && insight.targetRevPASH != null) {
      expect(insight.currentSlotRevPASH).toBeLessThan(insight.targetRevPASH);
    }
  });

  it("formats owner-facing evidence block", () => {
    const insight = computeRevenueInsight(priors, slowSlot, 40);
    const block = formatRevenueInsightEvidence(insight);
    expect(block).toContain("REVENUE INSIGHT:");
    expect(block).toContain("check_size");
    expect(block).toContain("Optimal dessert timing");
  });

  it("boosts dessert under check_size and suppresses under turnover", () => {
    expect(revenueStrategyPriorityBoost("dessert_nudge", "check_size")).toBeGreaterThan(
      0
    );
    expect(revenueStrategyPriorityBoost("dessert_nudge", "turnover")).toBeLessThan(0);
    expect(revenueStrategyPriorityBoost("bill_prompt", "turnover")).toBeGreaterThan(0);
  });

  it("exposes staff copilot hint for slow period", () => {
    const insight = computeRevenueInsight(priors, slowSlot, 40);
    expect(staffCopilotRevenueHint(insight)).toBe("Slow period — fokus na upsell");
  });
});

describe("per-table revenue posture", () => {
  it("derives low_check for €3 drink-only session", () => {
    expect(deriveCheckTier(3)).toBe("low_check");
    expect(
      staffCopilotTableRevenueHint({
        tableName: "3",
        checkTier: "low_check",
        checkEuros: 8,
      })
    ).toContain("food upsell");
  });

  it("derives high_check and digestif hint at €65", () => {
    expect(deriveCheckTier(65)).toBe("high_check");
    expect(
      staffCopilotTableRevenueHint({
        tableName: "7",
        checkTier: "high_check",
        checkEuros: 65,
      })
    ).toContain("digestiv");
  });

  it("rush + low_check → skip dessert in decideProactiveTurnPlan", () => {
    const result = decideProactiveTurnPlan({
      beliefs: { beliefs: [] },
      candidate: { kind: "dessert_nudge", message: "Desert?" },
      sessionPhase: "waiting",
      config: CONCIERGE_PLATFORM_DEFAULTS,
      cartLineCount: 0,
      revenueStrategy: "turnover",
      sessionCheckEuros: 3,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("revenue.turnover_skip_dessert");
    }
  });

  it("slow + low_check → food upsell priority boost", () => {
    expect(
      shouldOfferFoodUpsellForRevenue("check_size", "low_check")
    ).toBe(true);
    expect(
      revenueCheckTierPriorityBoost(
        "popularity_pair",
        "check_size",
        "low_check"
      )
    ).toBeGreaterThan(
      revenueCheckTierPriorityBoost("popularity_pair", "balanced", "normal")
    );
    expect(computeSessionCheckEuros([
      {
        id: "o1",
        status: "delivered",
        created_at: "",
        delivered_at: null,
        order_items: [
          {
            product_id: "p1",
            product_name: "Pivo",
            unit_price: 3,
            quantity: 1,
            menu_section: "drinks",
          },
        ],
      },
    ])).toBe(3);
  });
});

describe("daily revenue intelligence report", () => {
  it("formats avg order, upsell contribution, and low tables", () => {
    const report = buildDailyRevenueIntelligenceReport({
      orderCount: 78,
      revenueTotalEuros: 1833,
      revenueLastWeekSameDayEuros: 1700,
      denisUpsellEuros: 340,
      tableSessions: [
        { tableLabel: "sto 2", sessionRevenueEuros: 8, upsellRevenueEuros: 0 },
        { tableLabel: "sto 9", sessionRevenueEuros: 9, upsellRevenueEuros: 0 },
        { tableLabel: "sto 5", sessionRevenueEuros: 45, upsellRevenueEuros: 12 },
      ],
    });

    expect(report.avgOrderEuros).toBeCloseTo(23.5, 1);
    expect(report.denisUpsellContributionEuros).toBe(340);
    expect(identifyLowPerformingTableLabels([
      { tableLabel: "sto 2", sessionRevenueEuros: 8, upsellRevenueEuros: 0 },
      { tableLabel: "sto 9", sessionRevenueEuros: 9, upsellRevenueEuros: 0 },
    ])).toEqual(["sto 2", "sto 9"]);

    const lines = formatDailyRevenueIntelligenceLines(report);
    expect(lines[0]).toContain("€23.50");
    expect(lines[1]).toContain("€340");
    expect(lines[2]).toContain("sto 2");
    expect(lines[2]).toContain("sto 9");
  });
});
