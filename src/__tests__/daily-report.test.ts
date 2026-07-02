import { describe, expect, it } from "vitest";
import {
  buildDailyReport,
  formatDailyReportDigest,
} from "@/lib/admin/build-daily-report";
import type { FeedbackRow } from "@/lib/denis/platform/feedback-intelligence";

function feedbackRows(count: number, rating = 4.3): FeedbackRow[] {
  return Array.from({ length: count }, (_, index) => ({
    rating,
    sentiment: rating >= 4 ? "positive" : "neutral",
    category: index === 0 ? "wait_time" : "food",
    createdAt: new Date().toISOString(),
  }));
}

describe("buildDailyReport (T2)", () => {
  it("78 orders, 52 sessions, avg rating 4.3 → full report sections", () => {
    const orders = Array.from({ length: 78 }, (_, index) => ({
      id: `o-${index}`,
      total: 1633,
      created_at: `2026-06-27T${String(10 + (index % 8)).padStart(2, "0")}:15:00.000Z`,
      session_id: `s-${index}`,
      guest_token: null,
    }));

    const sessions = Array.from({ length: 52 }, (_, index) => ({
      id: `s-${index}`,
      opened_at: `2026-06-27T09:${String(index % 60).padStart(2, "0")}:00.000Z`,
      denis_shared_ai_session_id: `ai-${index}`,
      guest_token: index < 17 ? `guest-${index}` : null,
    }));

    const report = buildDailyReport({
      date: "2026-06-27",
      venueName: "Kafana Beograd",
      weekdayLabel: "Petak",
      currencyLabel: "RSD",
      orders,
      sessions,
      feedback: feedbackRows(12, 4.3),
      denisMetrics: {
        sessionsHandled: 52,
        upsellRevenue: 18200,
        upsellConversionRate: 0.143,
        proactiveNudgesSent: 34,
        nudgeAcceptRate: 0.35,
        avgResponseTime: 1400,
        creditsBurned: 145,
      },
      revenueYesterday: 113750,
      revenueLastWeekSameDay: 118000,
      prepTimeAvgMinutes: 14,
      slowestItem: { name: "Burger", avgMinutes: 22 },
      peakHour: "13:00-14:00",
      peakOrderCount: 18,
      returningGuestSessions: 17,
      newGuestSessions: 61,
    });

    expect(report.sections.revenue.orderCount).toBe(78);
    expect(report.sections.denis.sessionsHandled).toBe(52);
    expect(report.sections.guest.avgRating).toBe(4.3);
    expect(report.sections.guest.feedbackCount).toBe(12);
    expect(report.sections.kitchen.slowestItem.name).toBe("Burger");
    expect(report.sections.highlights.length).toBeGreaterThan(0);

    const digest = formatDailyReportDigest(report);
    expect(digest.text).toContain("DNEVNI IZVJEŠTAJ");
    expect(digest.text).toContain("Kafana Beograd");
    expect(digest.text).toContain("78");
    expect(digest.text).toContain("52");
    expect(digest.text).toContain("4.3");
    expect(digest.text).toContain("Burger");
    expect(report.sections.denisShift.stationQuestions).toHaveLength(2);
    expect(digest.text).toContain("DENIS SMENA");
  });

  it("includes denis shift metrics when station data is provided", () => {
    const report = buildDailyReport({
      date: "2026-06-27",
      venueName: "Kafana Beograd",
      weekdayLabel: "Petak",
      currencyLabel: "RSD",
      orders: [],
      sessions: [],
      feedback: [],
      denisMetrics: {
        sessionsHandled: 0,
        upsellRevenue: 0,
        upsellConversionRate: 0,
        proactiveNudgesSent: 0,
        nudgeAcceptRate: 0,
        avgResponseTime: 0,
        creditsBurned: 0,
      },
      revenueYesterday: 0,
      revenueLastWeekSameDay: 0,
      prepTimeAvgMinutes: 14,
      slowestItem: null,
      peakHour: "—",
      peakOrderCount: 0,
      returningGuestSessions: 0,
      newGuestSessions: 0,
      denisShift: {
        stationQuestions: [
          {
            station: "kitchen",
            status: "answered",
            asked_at: "2026-06-27T18:00:00.000Z",
            answered_at: "2026-06-27T18:05:00.000Z",
            expires_at: "2026-06-27T18:12:00.000Z",
            table_id: "t1",
            order_id: "o1",
          },
        ],
        staffNotifications: [
          {
            type: "denis_escalation",
            priority: "urgent",
            table_id: "t1",
            created_at: "2026-06-27T18:10:00.000Z",
          },
        ],
        waiterCalls: [],
        stationStates: [
          {
            station: "kitchen",
            in_prep_at: "2026-06-27T17:00:00.000Z",
            ready_at: "2026-06-27T17:18:00.000Z",
          },
        ],
        tableNames: { t1: "Sto 7" },
        kitchenFallbackPrepMinutes: 14,
      },
    });

    expect(report.sections.denisShift.preventedProblems).toBe(1);
    expect(report.sections.denisShift.riskiestTable?.tableName).toBe("Sto 7");
    expect(report.sections.denisShift.stationDelays[0]?.avgPrepMinutes).toBe(18);

    const digest = formatDailyReportDigest(report);
    expect(digest.text).toContain("Sprečeni problemi: 1");
    expect(digest.text).toContain("Sto 7");
    expect(digest.html).toContain("Denis smena");
  });

  it("sends report even with zero orders", () => {
    const report = buildDailyReport({
      date: "2026-06-27",
      venueName: "Test",
      weekdayLabel: "Petak",
      currencyLabel: "RSD",
      orders: [],
      sessions: [],
      feedback: [],
      denisMetrics: {
        sessionsHandled: 0,
        upsellRevenue: 0,
        upsellConversionRate: 0,
        proactiveNudgesSent: 0,
        nudgeAcceptRate: 0,
        avgResponseTime: 0,
        creditsBurned: 0,
      },
      revenueYesterday: 0,
      revenueLastWeekSameDay: 0,
      prepTimeAvgMinutes: null,
      slowestItem: null,
      peakHour: "—",
      peakOrderCount: 0,
      returningGuestSessions: 0,
      newGuestSessions: 0,
    });

    expect(report.sections.revenue.orderCount).toBe(0);
    expect(report.sections.issues.some((line) => line.includes("Nema narudžbi"))).toBe(
      true
    );
    expect(formatDailyReportDigest(report).text).toContain("DNEVNI IZVJEŠTAJ");
  });

  it("compares revenue vs last week same day not only yesterday", () => {
    const report = buildDailyReport({
      date: "2026-06-27",
      venueName: "Test",
      weekdayLabel: "Petak",
      currencyLabel: "RSD",
      orders: [{ id: "1", total: 127400, created_at: "2026-06-27T12:00:00Z", session_id: null, guest_token: null }],
      sessions: [],
      feedback: [],
      denisMetrics: {
        sessionsHandled: 0,
        upsellRevenue: 0,
        upsellConversionRate: 0,
        proactiveNudgesSent: 0,
        nudgeAcceptRate: 0,
        avgResponseTime: 0,
        creditsBurned: 0,
      },
      revenueYesterday: 113750,
      revenueLastWeekSameDay: 118000,
      prepTimeAvgMinutes: null,
      slowestItem: null,
      peakHour: "—",
      peakOrderCount: 0,
      returningGuestSessions: 0,
      newGuestSessions: 0,
    });

    expect(report.sections.revenue.vsYesterday).toBeGreaterThan(0);
    expect(report.sections.revenue.vsLastWeekSameDay).toBeGreaterThan(0);
  });
});
