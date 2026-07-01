import { describe, expect, it } from "vitest";
import {
  aggregateDailyExperienceScores,
  buildExperienceScoreTrend,
  buildLowExperienceStaffAlertMessage,
  computeRealtimeExperienceScore,
  correlateExperienceWithRevenue,
  ratingToSentiment,
  resolveExperienceDenisHint,
  resolveExperienceReviewMode,
  resolveExperienceScoreBand,
  resolveExperienceTippingMode,
  shouldEmitLowExperienceStaffAlert,
} from "@/lib/commerce/experience/resolve-experience-moment";
import { detectLowExperienceStaffAlert } from "@/lib/denis/cognition/proactive/triggers";
import { detectStaffProactiveAlerts } from "@/lib/denis/cognition/proactive/detect-staff-proactive";
import { CONCIERGE_PLATFORM_DEFAULTS } from "@/lib/denis/config/concierge-defaults";

describe("computeRealtimeExperienceScore", () => {
  it("scores 9 for 5min wait + accurate order", () => {
    const result = computeRealtimeExperienceScore({
      waitMinutes: 5,
      denisQuality: "neutral",
      orderAccurate: true,
      proactiveHelpful: false,
      frustrationEvents: 0,
    });

    expect(result.score).toBe(9);
    expect(result.band).toBe("high");
    expect(result.tippingMode).toBe("aggressive");
    expect(result.reviewMode).toBe("google");
    expect(result.staffAlert).toBe(false);
  });

  it("scores 3 for 25min wait + wrong order with denis good + proactive", () => {
    const result = computeRealtimeExperienceScore({
      waitMinutes: 25,
      denisQuality: "good",
      orderAccurate: false,
      proactiveHelpful: true,
      frustrationEvents: 0,
    });

    expect(result.score).toBe(3);
    expect(result.band).toBe("low");
    expect(result.tippingMode).toBe("apology");
    expect(result.reviewMode).toBe("internal");
    expect(result.staffAlert).toBe(true);
  });

  it("applies frustration events at -1 each", () => {
    const result = computeRealtimeExperienceScore({
      waitMinutes: 5,
      denisQuality: "neutral",
      orderAccurate: true,
      proactiveHelpful: false,
      frustrationEvents: 2,
    });

    expect(result.score).toBe(7);
    expect(result.breakdown.frustrationDelta).toBe(-2);
  });
});

describe("score → behavior", () => {
  it("maps bands to tipping and review modes", () => {
    expect(resolveExperienceScoreBand(9)).toBe("high");
    expect(resolveExperienceTippingMode(9)).toBe("aggressive");
    expect(resolveExperienceReviewMode(9)).toBe("google");

    expect(resolveExperienceScoreBand(6)).toBe("mid");
    expect(resolveExperienceTippingMode(6)).toBe("gentle");
    expect(resolveExperienceReviewMode(6)).toBe("none");

    expect(resolveExperienceScoreBand(3)).toBe("low");
    expect(resolveExperienceTippingMode(3)).toBe("apology");
    expect(resolveExperienceReviewMode(3)).toBe("internal");
  });

  it("emits staff alert below score 4", () => {
    expect(shouldEmitLowExperienceStaffAlert(3.9)).toBe(true);
    expect(shouldEmitLowExperienceStaffAlert(4)).toBe(false);
  });
});

describe("Denis narration hints", () => {
  it("celebrates high score and apologizes on low score", () => {
    expect(resolveExperienceDenisHint({ score: 9, language: "sr" })).toBe(
      "Nadam se da uživate! Desert?"
    );
    expect(resolveExperienceDenisHint({ score: 3, language: "sr" })).toBe(
      "Žao mi je za čekanje. Možda besplatan desert?"
    );
    expect(resolveExperienceDenisHint({ score: 6, language: "sr" })).toBeNull();
  });
});

describe("staff low experience alert", () => {
  it("builds Serbian floor message", () => {
    expect(
      buildLowExperienceStaffAlertMessage({
        tableName: "3",
        score: 3,
        language: "sr",
      })
    ).toContain("Sto 3 ima loše iskustvo");
  });

  it("detects alert via trigger helper", () => {
    const alert = detectLowExperienceStaffAlert({
      tableName: "3",
      experienceScore: 3,
      language: "sr",
    });

    expect(alert).toMatchObject({
      kind: "staff_low_experience",
      tableName: "3",
    });
    expect(alert?.message).toContain("interveniši");
  });

  it("surfaces in detectStaffProactiveAlerts", () => {
    const alerts = detectStaffProactiveAlerts({
      config: CONCIERGE_PLATFORM_DEFAULTS,
      tableName: "3",
      idleMinutes: 0,
      emittedKeys: [],
      recentGuestMessages: [],
      waiterEscalated: false,
      experienceScore: 3,
      language: "sr",
    });

    expect(alerts.some((alert) => alert.kind === "staff_low_experience")).toBe(
      true
    );
  });
});

describe("analytics", () => {
  it("aggregates daily average experience scores", () => {
    const daily = aggregateDailyExperienceScores([
      { date: "2026-06-27", score: 9, revenueCents: 5000 },
      { date: "2026-06-27", score: 7, revenueCents: 3000 },
      { date: "2026-06-28", score: 5, revenueCents: 2000 },
    ]);

    expect(daily).toEqual([
      {
        date: "2026-06-27",
        averageScore: 8,
        sessionCount: 2,
        revenueCents: 8000,
      },
      {
        date: "2026-06-28",
        averageScore: 5,
        sessionCount: 1,
        revenueCents: 2000,
      },
    ]);
  });

  it("builds trend from daily averages", () => {
    const daily = aggregateDailyExperienceScores([
      { date: "2026-06-25", score: 8 },
      { date: "2026-06-26", score: 8 },
      { date: "2026-06-27", score: 8 },
      { date: "2026-06-28", score: 5 },
      { date: "2026-06-29", score: 5 },
      { date: "2026-06-30", score: 5 },
    ]);

    const trend = buildExperienceScoreTrend(daily, 3);
    expect(trend?.direction).toBe("down");
    expect(trend?.delta).toBe(-3);
  });

  it("correlates daily experience with revenue", () => {
    const daily = aggregateDailyExperienceScores([
      { date: "2026-06-27", score: 9, revenueCents: 9000 },
      { date: "2026-06-28", score: 5, revenueCents: 5000 },
      { date: "2026-06-29", score: 3, revenueCents: 3000 },
    ]);

    const correlation = correlateExperienceWithRevenue(
      daily.map((row) => ({
        date: row.date,
        experienceScore: row.averageScore,
        revenueCents: row.revenueCents,
      }))
    );

    expect(correlation).toBe(1);
  });
});

describe("ratingToSentiment", () => {
  it("maps star ratings to sentiment buckets", () => {
    expect(ratingToSentiment(5)).toBe("positive");
    expect(ratingToSentiment(3)).toBe("neutral");
    expect(ratingToSentiment(2)).toBe("negative");
  });
});
