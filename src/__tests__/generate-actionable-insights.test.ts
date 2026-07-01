import { describe, expect, it } from "vitest";
import {
  generateActionableInsights,
  insightDeliveryTier,
} from "@/lib/dashboard/generate-actionable-insights";
import { partitionInsightsByDeliveryTier } from "@/lib/dashboard/dispatch-actionable-insights";

const emptyPeriod = {
  aiRevenue: 0,
  conversionRate: 0.2,
  addedCount: 0,
  recommendedCount: 0,
  sessionCount: 0,
  averageRating: null,
  avgMinutesToFirstOrder: null,
};

describe("generateActionableInsights", () => {
  it("creates problem insight after 5 slow_kitchen signals", () => {
    const insights = generateActionableInsights({
      currentPeriod: emptyPeriod,
      previousPeriod: emptyPeriod,
      menuGaps: [],
      slowKitchenSignalCount: 5,
    });

    const slow = insights.find((row) => row.id === "problem-slow-kitchen");
    expect(slow?.type).toBe("problem");
    expect(slow?.impact).toBe("high");
    expect(slow?.detail).toContain("slow_kitchen");
  });

  it("creates opportunity insight for 8x vegan menu gap searches", () => {
    const insights = generateActionableInsights({
      currentPeriod: emptyPeriod,
      previousPeriod: emptyPeriod,
      menuGaps: [{ term: "vegan", count: 8 }],
      avgDessertPrice: 70,
      currencyLabel: "€",
      revenueEstimateFactor: 1,
    });

    const vegan = insights.find((row) => row.id === "menu-gap-vegan");
    expect(vegan?.type).toBe("opportunity");
    expect(vegan?.detail).toContain("8");
    expect(vegan?.suggestedAction).toContain("vegan");
  });

  it("creates experiment_result insight when A/B test has clear winner", () => {
    const insights = generateActionableInsights({
      currentPeriod: emptyPeriod,
      previousPeriod: emptyPeriod,
      menuGaps: [],
      abExperiments: [
        {
          experimentId: "exp-dessert-timing",
          label: "Desert nudge at 12min vs 18min",
          variantALabel: "12 min",
          variantBLabel: "18 min",
          liftPct: 0.15,
          winner: "B",
        },
      ],
    });

    const experiment = insights.find(
      (row) => row.id === "experiment-exp-dessert-timing"
    );
    expect(experiment?.type).toBe("experiment_result");
    expect(experiment?.title).toContain("15%");
    expect(experiment?.suggestedAction).toContain("Primeni pobednika");
  });

  it("creates prep time problem with frustrated guests", () => {
    const insights = generateActionableInsights({
      currentPeriod: emptyPeriod,
      previousPeriod: emptyPeriod,
      menuGaps: [],
      prepTimeAlerts: [
        {
          productName: "Schnitzel",
          avgMinutes: 22,
          targetMinutes: 15,
          frustrationCount: 5,
        },
      ],
    });

    const prep = insights.find((row) => row.id === "problem-prep-schnitzel");
    expect(prep?.type).toBe("problem");
    expect(prep?.title).toContain("22min");
    expect(prep?.detail).toContain("5 frustrirana");
  });

  it("creates achievement for Denis upsell conversion lift", () => {
    const insights = generateActionableInsights({
      currentPeriod: { ...emptyPeriod, conversionRate: 0.31, recommendedCount: 100, addedCount: 31 },
      previousPeriod: { ...emptyPeriod, conversionRate: 0.23 },
      menuGaps: [],
    });

    const achievement = insights.find((row) => row.id === "achievement-conversion");
    expect(achievement?.type).toBe("achievement");
    expect(achievement?.title).toContain("Denis konverzija");
  });

  it("creates opportunity insight for repeated menu gap (cheesecake ×12 @ 400 RSD)", () => {
    const insights = generateActionableInsights({
      currentPeriod: {
        aiRevenue: 0,
        conversionRate: 0.2,
        addedCount: 4,
        recommendedCount: 20,
        sessionCount: 15,
        averageRating: null,
        avgMinutesToFirstOrder: null,
      },
      previousPeriod: {
        aiRevenue: 0,
        conversionRate: 0.18,
        addedCount: 3,
        recommendedCount: 18,
        sessionCount: 12,
        averageRating: null,
        avgMinutesToFirstOrder: null,
      },
      menuGaps: [{ term: "cheesecake", count: 12 }],
      avgDessertPrice: 400,
      currencyLabel: "RSD",
      revenueEstimateFactor: 0.7,
    });

    expect(insights.length).toBeGreaterThan(0);

    const cheesecake = insights.find((row) => row.id === "menu-gap-cheesecake");
    expect(cheesecake).toBeDefined();
    expect(cheesecake?.type).toBe("opportunity");
    expect(cheesecake?.impact).toBe("high");
    expect(cheesecake?.suggestedAction).toContain("cheesecake");
    expect(cheesecake?.detail).toContain("12");
    expect(cheesecake?.detail).toContain("3.360");
    expect(cheesecake?.metric).toEqual({
      before: 0,
      after: 12,
      unit: "traženja",
    });
  });

  it("caps insights at 5 per day", () => {
    const insights = generateActionableInsights({
      currentPeriod: {
        aiRevenue: 1000,
        conversionRate: 0.5,
        addedCount: 10,
        recommendedCount: 20,
        sessionCount: 10,
        averageRating: 4.5,
        avgMinutesToFirstOrder: 5,
      },
      previousPeriod: {
        aiRevenue: 500,
        conversionRate: 0.2,
        addedCount: 4,
        recommendedCount: 20,
        sessionCount: 10,
        averageRating: 4,
        avgMinutesToFirstOrder: 8,
      },
      menuGaps: [
        { term: "cheesecake", count: 12 },
        { term: "tiramisu", count: 10 },
        { term: "brownie", count: 8 },
        { term: "panna cotta", count: 7 },
        { term: "mousse", count: 6 },
        { term: "pavlova", count: 5 },
      ],
      avgDessertPrice: 400,
    });

    expect(insights.length).toBeLessThanOrEqual(5);
  });

  it("routes high-impact problems as critical delivery", () => {
    const insight = {
      id: "problem-wait-time",
      type: "problem" as const,
      title: "Čekanje raste",
      detail: "test",
      impact: "high" as const,
      suggestedAction: "Dodaj kapacitet",
      metric: null,
    };

    expect(insightDeliveryTier(insight)).toBe("critical");
  });

  it("routes high-impact opportunities as daily delivery", () => {
    const insight = {
      id: "menu-gap-cheesecake",
      type: "opportunity" as const,
      title: "Dodaj Cheesecake",
      detail: "test",
      impact: "high" as const,
      suggestedAction: "Dodaj na meni",
      metric: null,
    };

    expect(insightDeliveryTier(insight)).toBe("daily");
  });

  it("routes medium insights as weekly delivery", () => {
    const insight = {
      id: "menu-gap-brownie",
      type: "opportunity" as const,
      title: "Dodaj Brownie",
      detail: "test",
      impact: "medium" as const,
      suggestedAction: "Dodaj na meni",
      metric: null,
    };

    expect(insightDeliveryTier(insight)).toBe("weekly");
  });
});

describe("partitionInsightsByDeliveryTier", () => {
  it("splits critical, daily, and weekly buckets", () => {
    const insights = [
      {
        id: "problem-slow-kitchen",
        type: "problem" as const,
        title: "Slow kitchen",
        detail: "test",
        impact: "high" as const,
        suggestedAction: "Fix kitchen",
        metric: null,
      },
      {
        id: "menu-gap-vegan",
        type: "opportunity" as const,
        title: "Vegan gap",
        detail: "test",
        impact: "high" as const,
        suggestedAction: "Add vegan",
        metric: null,
      },
      {
        id: "menu-gap-brownie",
        type: "opportunity" as const,
        title: "Brownie",
        detail: "test",
        impact: "medium" as const,
        suggestedAction: "Add brownie",
        metric: null,
      },
    ];

    const buckets = partitionInsightsByDeliveryTier(insights);
    expect(buckets.critical).toHaveLength(1);
    expect(buckets.daily).toHaveLength(1);
    expect(buckets.weekly).toHaveLength(1);
  });
});
