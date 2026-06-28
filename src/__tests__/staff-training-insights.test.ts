import { describe, expect, it } from "vitest";
import {
  analyzeStaffPerformance,
  buildStaffLeaderboard,
  buildTrainingRecommendations,
  formatStaffTrainingDigestLines,
  generateStaffTrainingInsights,
  MIN_TRAINING_DATA_POINTS,
  summarizeStaffTrainingInsights,
} from "@/lib/admin/staff-training-insights";

describe("generateStaffTrainingInsights", () => {
  it("returns speed action_needed for 45 burger orders and 5 frustration events", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: Array.from({ length: 5 }, (_, index) => ({
        sessionId: `session-${index}`,
        productName: "Burger",
      })),
      waitTimes: [
        {
          productName: "Burger",
          orderCount: 45,
          avgMinutes: 22,
          targetMinutes: 15,
          frustrationCount: 5,
        },
      ],
      allergyAlerts: [],
      idleTableEvents: [],
      upsellConversions: [],
      periodDays: 30,
    });

    const speed = insights.find((row) => row.area === "speed");
    expect(speed).toBeDefined();
    expect(speed?.severity).toBe("action_needed");
    expect(speed?.dataPoints).toBe(45);
    expect(speed?.title).toContain("Burger");
    expect(speed?.suggestedTraining).toContain("Burger");
  });

  it("emits critical allergy training for a near-miss event", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: [],
      waitTimes: [],
      allergyAlerts: [{ sessionId: "session-1", isNearMiss: true }],
      idleTableEvents: [],
      upsellConversions: [],
      periodDays: 7,
    });

    const allergy = insights.find((row) => row.area === "allergy");
    expect(allergy?.severity).toBe("critical");
    expect(allergy?.title).toContain("near-miss");
  });

  it("returns speed action_needed for frustration threshold without over-target prep", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: Array.from({ length: 5 }, (_, index) => ({
        sessionId: `session-${index}`,
        productName: "Burger",
      })),
      waitTimes: [
        {
          productName: "Burger",
          orderCount: 45,
          avgMinutes: 12,
          targetMinutes: 15,
          frustrationCount: 5,
        },
      ],
      allergyAlerts: [],
      idleTableEvents: [],
      upsellConversions: [],
      periodDays: 30,
    });

    const speed = insights.find((row) => row.area === "speed");
    expect(speed?.severity).toBe("action_needed");
    expect(speed?.title).toContain("frustration");
  });

  it("requires minimum data points before emitting insights", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: [],
      waitTimes: [
        {
          productName: "Burger",
          orderCount: MIN_TRAINING_DATA_POINTS - 1,
          avgMinutes: 30,
          targetMinutes: 15,
          frustrationCount: 5,
        },
      ],
      allergyAlerts: [],
      idleTableEvents: [],
      upsellConversions: [],
      periodDays: 30,
    });

    expect(insights).toEqual([]);
  });

  it("emits communication action_needed when handoff rate exceeds 20%", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: [],
      waitTimes: [],
      allergyAlerts: [],
      idleTableEvents: [],
      upsellConversions: [],
      handoffStats: [{ totalSessions: 100, handoffCount: 25 }],
      periodDays: 30,
    });

    const communication = insights.find((row) => row.area === "communication");
    expect(communication?.severity).toBe("action_needed");
    expect(communication?.title).toContain("Staff ne odgovara");
  });

  it("emits upsell info when Denis handles most dessert nudges", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: [],
      waitTimes: [],
      allergyAlerts: [],
      idleTableEvents: [],
      upsellConversions: [
        {
          totalSessions: 120,
          denisDessertNudges: 110,
          staffDessertOffers: 10,
        },
      ],
      periodDays: 30,
    });

    const upsell = insights.find((row) => row.area === "upsell");
    expect(upsell?.severity).toBe("info");
    expect(upsell?.title).toContain("92%");
  });

  it("emits attention action_needed for idle tables", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: [],
      waitTimes: [],
      allergyAlerts: [],
      idleTableEvents: Array.from({ length: 20 }, (_, index) => ({
        sessionId: `idle-${index}`,
        idleMinutes: 12,
      })),
      upsellConversions: [],
      periodDays: 7,
    });

    const attention = insights.find((row) => row.area === "attention");
    expect(attention?.severity).toBe("action_needed");
    expect(attention?.dataPoints).toBe(20);
  });
});

describe("analyzeStaffPerformance", () => {
  it("flags slower staff for speed and attention training", () => {
    const rows = analyzeStaffPerformance([
      {
        staffId: "a",
        staffName: "Konobar A",
        orderCount: 45,
        avgResponseMinutes: 3,
        complaintCount: 2,
      },
      {
        staffId: "b",
        staffName: "Konobar B",
        orderCount: 38,
        avgResponseMinutes: 8,
        complaintCount: 5,
      },
    ]);

    const waiterB = rows.find((row) => row.staffId === "b");
    expect(waiterB?.recommendedAreas).toContain("speed");
    expect(waiterB?.recommendedAreas).toContain("attention");
    expect(waiterB?.summary).toContain("speed");
  });
});

describe("buildTrainingRecommendations", () => {
  it("builds allergy and upsell recommendation lines", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: [],
      waitTimes: [],
      allergyAlerts: [
        { sessionId: "s1", isNearMiss: true },
        { sessionId: "s2", isNearMiss: true },
        { sessionId: "s3", isNearMiss: true },
      ],
      idleTableEvents: [],
      upsellConversions: [
        {
          totalSessions: 120,
          denisDessertNudges: 96,
          staffDessertOffers: 6,
        },
      ],
      periodDays: 7,
    });

    const recommendations = buildTrainingRecommendations({
      insights,
      periodDays: 7,
    });

    expect(
      recommendations.some((row) => row.message.includes("Allergy awareness"))
    ).toBe(true);
    expect(
      recommendations.some((row) => row.message.includes("Upsell techniques"))
    ).toBe(true);
  });
});

describe("buildStaffLeaderboard", () => {
  it("returns leaderboard entries only for opted-in staff", () => {
    const entries = buildStaffLeaderboard({
      performance: [
        {
          staffId: "a",
          staffName: "Konobar A",
          orderCount: 40,
          avgResponseMinutes: 3,
          complaintCount: 1,
        },
        {
          staffId: "b",
          staffName: "Konobar B",
          orderCount: 35,
          avgResponseMinutes: 8,
          complaintCount: 2,
        },
      ],
      tipsByStaffId: { a: 42.5, b: 12 },
      ratingsByStaffId: {
        a: { sum: 18, count: 4 },
        b: { sum: 12, count: 3 },
      },
      optedInStaffIds: new Set(["a"]),
    });

    expect(entries.every((row) => row.staffId === "a")).toBe(true);
    expect(entries.some((row) => row.metric === "fastest_response")).toBe(true);
  });
});

describe("staff training digest formatting", () => {
  it("formats top areas and concrete actions", () => {
    const insights = generateStaffTrainingInsights({
      frustrationEvents: Array.from({ length: 5 }, (_, index) => ({
        sessionId: `session-${index}`,
        productName: "Burger",
      })),
      waitTimes: [
        {
          productName: "Burger",
          orderCount: 45,
          avgMinutes: 22,
          targetMinutes: 15,
          frustrationCount: 5,
        },
      ],
      allergyAlerts: [],
      idleTableEvents: [],
      upsellConversions: [],
      periodDays: 30,
    });

    const summary = summarizeStaffTrainingInsights({
      insights,
      priorInsights: [],
      periodDays: 30,
    });

    const recommendations = buildTrainingRecommendations({
      insights,
      periodDays: 30,
    });

    const lines = formatStaffTrainingDigestLines({
      insights,
      summary,
      periodDays: 30,
      recommendations,
    });

    expect(lines[0]).toContain("speed");
    expect(lines.some((line) => line.includes("⚠️"))).toBe(true);
    expect(lines.some((line) => line.startsWith("Preporuka:"))).toBe(true);
  });
});
