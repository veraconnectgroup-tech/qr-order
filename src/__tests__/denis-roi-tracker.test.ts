import { describe, expect, it } from "vitest";
import {
  aggregateDenisRoiMetrics,
  buildTopDenisContributions,
  formatWeeklyDenisRoiDigest,
  totalDenisAttributedRevenueEuros,
} from "@/lib/billing/denis-roi-tracker";

describe("aggregateDenisRoiMetrics", () => {
  it("sums upsell, win-back, conversations, and allergy events", () => {
    const metrics = aggregateDenisRoiMetrics([
      { event_type: "upsell_accepted", amount_cents: 450, quantity: 1 },
      { event_type: "upsell_accepted", amount_cents: 320, quantity: 1 },
      { event_type: "win_back_returned", amount_cents: 8500, quantity: 1 },
      { event_type: "conversation", amount_cents: 0, quantity: 3 },
      { event_type: "allergy_warning", amount_cents: 0, quantity: 2 },
      { event_type: "allergy_block", amount_cents: 0, quantity: 1 },
    ]);

    expect(metrics.upsellAccepted).toBe(2);
    expect(metrics.upsellRevenueCents).toBe(770);
    expect(metrics.winBackReturned).toBe(1);
    expect(metrics.winBackRevenueCents).toBe(8500);
    expect(metrics.denisConversations).toBe(3);
    expect(metrics.estimatedMinutesSaved).toBe(6);
    expect(metrics.allergyWarnings).toBe(2);
    expect(metrics.allergyBlocks).toBe(1);
  });
});

describe("totalDenisAttributedRevenueEuros", () => {
  it("combines upsell and win-back revenue", () => {
    const total = totalDenisAttributedRevenueEuros({
      upsellAccepted: 5,
      upsellRevenueCents: 78600,
      winBackSent: 2,
      winBackReturned: 1,
      winBackRevenueCents: 8500,
      denisConversations: 10,
      estimatedMinutesSaved: 20,
      allergyWarnings: 1,
      allergyBlocks: 0,
      avgGuestRating: 4.5,
      complaintsHandled: 0,
      complaintsResolved: 0,
    });
    expect(total).toBe(871);
  });
});

describe("buildTopDenisContributions", () => {
  it("ranks upsell nudges, win-back, allergy, and time saved", () => {
    const items = buildTopDenisContributions(
      {
        upsellAccepted: 43,
        upsellRevenueCents: 78600,
        winBackSent: 12,
        winBackReturned: 3,
        winBackRevenueCents: 8500,
        denisConversations: 1260,
        estimatedMinutesSaved: 2520,
        allergyWarnings: 2,
        allergyBlocks: 1,
        avgGuestRating: 4.8,
        complaintsHandled: 0,
        complaintsResolved: 0,
      },
      [
        { label: "Još jedno pivo?", accepted: 43, revenueEuros: 234 },
        { label: "Desert nudge", accepted: 28, revenueEuros: 189 },
      ]
    );

    expect(items[0]?.label).toBe("Još jedno pivo?");
    expect(items.some((row) => row.label === "Win-back SMS")).toBe(true);
    expect(items.some((row) => row.label === "Alergen upozorenja")).toBe(true);
    expect(items.some((row) => row.label === "Konobar vreme")).toBe(true);
    expect(items.length).toBeLessThanOrEqual(5);
  });
});

describe("formatWeeklyDenisRoiDigest", () => {
  const metrics = {
    upsellAccepted: 43,
    upsellRevenueCents: 78600,
    winBackSent: 12,
    winBackReturned: 3,
    winBackRevenueCents: 8500,
    denisConversations: 234,
    estimatedMinutesSaved: 468,
    allergyWarnings: 1,
    allergyBlocks: 0,
    avgGuestRating: 0,
    complaintsHandled: 0,
    complaintsResolved: 0,
  };

  it("formats Serbian digest", () => {
    const lines = formatWeeklyDenisRoiDigest({
      metrics,
      planCostEuros: 49,
      language: "sr",
    });
    expect(lines[0]).toContain("Ovonedeljni Denis");
    expect(lines.some((line) => line.includes("234 razgovora"))).toBe(true);
    expect(lines.some((line) => line.includes("ROI:"))).toBe(true);
  });

  it("formats German digest", () => {
    const lines = formatWeeklyDenisRoiDigest({
      metrics,
      planCostEuros: 49,
      language: "de",
    });
    expect(lines[0]).toContain("Denis Wochenbericht");
  });

  it("formats English digest", () => {
    const lines = formatWeeklyDenisRoiDigest({
      metrics,
      planCostEuros: 49,
      language: "en",
    });
    expect(lines[0]).toContain("Weekly Denis report");
  });
});
