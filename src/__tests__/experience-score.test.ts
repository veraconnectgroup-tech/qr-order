import { describe, expect, it } from "vitest";
import {
  buildExperienceScore,
  buildExperienceScoreComponents,
  calculateExperienceScore,
  detectExperienceScoreAlert,
} from "@/lib/denis/analytics/experience-score";

describe("calculateExperienceScore", () => {
  it("scores high-converting efficient sessions highly", () => {
    const components = buildExperienceScoreComponents({
      sessionsTotal: 100,
      convertedSessions: 85,
      abandonedSessions: 5,
      cartCorrections: 2,
      repeatedQuestions: 1,
      totalTurns: 170,
      orderTimeSecondsTotal: 85 * 180,
      returningGuestSessions: 30,
    });

    const score = calculateExperienceScore(components);
    expect(score).toBeGreaterThan(80);
    expect(components.conversionRate).toBeCloseTo(0.85, 2);
    expect(components.avgTurnsToOrder).toBeCloseTo(2, 1);
  });

  it("penalizes high correction and repeat rates", () => {
    const good = calculateExperienceScore(
      buildExperienceScoreComponents({
        sessionsTotal: 50,
        convertedSessions: 40,
        abandonedSessions: 3,
        cartCorrections: 1,
        repeatedQuestions: 0,
        totalTurns: 120,
        orderTimeSecondsTotal: 40 * 200,
        returningGuestSessions: 10,
      })
    );

    const poor = calculateExperienceScore(
      buildExperienceScoreComponents({
        sessionsTotal: 50,
        convertedSessions: 40,
        abandonedSessions: 3,
        cartCorrections: 15,
        repeatedQuestions: 12,
        totalTurns: 240,
        orderTimeSecondsTotal: 40 * 400,
        returningGuestSessions: 4,
      })
    );

    expect(poor).toBeLessThan(good);
  });
});

describe("buildExperienceScore", () => {
  it("builds score from seeded session outcomes", () => {
    const result = buildExperienceScore({
      date: "2026-06-26",
      locationId: "loc-1",
      daily: {
        sessionsTotal: 52,
        convertedSessions: 44,
        abandonedSessions: 4,
        cartCorrections: 3,
        repeatedQuestions: 2,
        totalTurns: 132,
        orderTimeSecondsTotal: 44 * 192,
        returningGuestSessions: 18,
      },
    });

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.components.conversionRate).toBeCloseTo(44 / 52, 2);
  });
});

describe("detectExperienceScoreAlert", () => {
  it("alerts when score drops more than 10% over 3 days", () => {
    const trend = [
      { date: "2026-06-20", score: 90 },
      { date: "2026-06-21", score: 89 },
      { date: "2026-06-22", score: 88 },
      { date: "2026-06-23", score: 87 },
      { date: "2026-06-24", score: 65 },
      { date: "2026-06-25", score: 64 },
      { date: "2026-06-26", score: 63 },
    ];

    const alert = detectExperienceScoreAlert(trend);
    expect(alert).not.toBeNull();
    expect(alert?.severity).toBe("critical");
    expect(alert?.message).toContain("63");
  });

  it("returns null when score is stable", () => {
    const trend = [
      { date: "2026-06-20", score: 84 },
      { date: "2026-06-21", score: 85 },
      { date: "2026-06-22", score: 86 },
      { date: "2026-06-23", score: 85 },
      { date: "2026-06-24", score: 86 },
      { date: "2026-06-25", score: 87 },
      { date: "2026-06-26", score: 85 },
    ];

    expect(detectExperienceScoreAlert(trend)).toBeNull();
  });
});
