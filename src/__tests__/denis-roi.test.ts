import { describe, expect, it } from "vitest";
import {
  aggregateDenisRoiRows,
  buildDenisRoiData,
  formatOrderDuration,
  formatRoiRatio,
  type ExperienceAnalyticsDailyRow,
} from "@/lib/dashboard/denis-roi";

function seedRow(
  date: string,
  overrides: Partial<ExperienceAnalyticsDailyRow> = {}
): ExperienceAnalyticsDailyRow {
  return {
    metric_date: date,
    sessions_closed: 40,
    session_revenue_total: 400,
    converted_sessions: 28,
    upsell_revenue_total: 70,
    ai_cost_cents: 120,
    t0_turns: 58,
    llm_turns: 42,
    returning_guest_sessions: 14,
    order_time_seconds_total: 5376,
    by_nudge_revenue: {
      dessert_upsell: { accepted: 12, revenue: 96 },
      drink_pairing: { accepted: 8, revenue: 24 },
    },
    ...overrides,
  };
}

describe("aggregateDenisRoiRows", () => {
  it("sums daily rollup rows into period totals", () => {
    const agg = aggregateDenisRoiRows([
      seedRow("2026-06-01"),
      seedRow("2026-06-02", {
        sessions_closed: 20,
        session_revenue_total: 221.5,
        converted_sessions: 15,
        upsell_revenue_total: 35,
        ai_cost_cents: 80,
        t0_turns: 30,
        llm_turns: 20,
        returning_guest_sessions: 6,
        order_time_seconds_total: 2880,
      }),
    ]);

    expect(agg.sessionsTotal).toBe(60);
    expect(agg.sessionsConverted).toBe(43);
    expect(agg.revenueTotal).toBe(621.5);
    expect(agg.upsellRevenue).toBe(105);
    expect(agg.aiCostCents).toBe(200);
    expect(agg.t0Turns).toBe(88);
    expect(agg.llmTurns).toBe(62);
    expect(agg.returningGuestSessions).toBe(20);
    expect(agg.daily).toHaveLength(2);
  });

  it("merges by_nudge_revenue across days", () => {
    const agg = aggregateDenisRoiRows([
      seedRow("2026-06-01"),
      seedRow("2026-06-02", {
        by_nudge_revenue: {
          dessert_upsell: { accepted: 5, revenue: 40 },
          side_dish: { accepted: 3, revenue: 9 },
        },
      }),
    ]);

    expect(agg.nudgeRevenue.get("dessert_upsell")).toEqual({
      accepted: 17,
      revenue: 136,
    });
    expect(agg.nudgeRevenue.get("side_dish")).toEqual({
      accepted: 3,
      revenue: 9,
    });
  });
});

describe("buildDenisRoiData", () => {
  it("computes ROI, conversion, and vs-previous deltas from seeded analytics", () => {
    const current = aggregateDenisRoiRows([
      seedRow("2026-06-20", {
        sessions_closed: 100,
        session_revenue_total: 12430,
        converted_sessions: 68,
        upsell_revenue_total: 2140,
        ai_cost_cents: 4720,
        t0_turns: 580,
        llm_turns: 420,
        returning_guest_sessions: 34,
        order_time_seconds_total: 68 * 192,
        by_nudge_revenue: {
          dessert_upsell: { accepted: 234, revenue: 1870 },
          drink_pairing: { accepted: 189, revenue: 567 },
          side_dish: { accepted: 98, revenue: 294 },
        },
      }),
    ]);

    const previous = aggregateDenisRoiRows([
      seedRow("2026-05-20", {
        sessions_closed: 92,
        session_revenue_total: 11100,
        converted_sessions: 60,
        upsell_revenue_total: 1800,
        ai_cost_cents: 4500,
        t0_turns: 500,
        llm_turns: 450,
        returning_guest_sessions: 28,
        order_time_seconds_total: 60 * 200,
      }),
    ]);

    const data = buildDenisRoiData(current, previous, {
      start: "2026-06-20",
      end: "2026-06-20",
    });

    expect(data.revenue.total).toBe(12430);
    expect(data.revenue.denisUpsell).toBe(2140);
    expect(data.revenue.upsellPercent).toBeCloseTo(17.2, 0);
    expect(data.revenue.vsPrevious).toBeCloseTo(12.0, 0);

    expect(data.sessions.total).toBe(100);
    expect(data.sessions.converted).toBe(68);
    expect(data.sessions.conversionRate).toBeCloseTo(0.68, 2);
    expect(data.sessions.avgOrderTimeSeconds).toBe(192);

    expect(data.cost.totalAiCost).toBeCloseTo(47.2, 1);
    expect(data.cost.costPerSession).toBeCloseTo(0.472, 2);
    expect(data.cost.t0Percent).toBeCloseTo(0.58, 2);
    expect(data.cost.roi).toBeCloseTo(2140 / 47.2, 0);

    expect(data.guests.returning).toBe(34);
    expect(data.guests.returningPercent).toBeCloseTo(0.34, 2);

    expect(data.topPerformers[0]?.category).toBe("dessert_upsell");
    expect(data.topPerformers[0]?.accepted).toBe(234);
    expect(data.topPerformers[0]?.revenue).toBe(1870);
  });
});

describe("format helpers", () => {
  it("formats order duration", () => {
    expect(formatOrderDuration(192)).toBe("3m 12s");
    expect(formatOrderDuration(45)).toBe("45s");
    expect(formatOrderDuration(0)).toBe("—");
  });

  it("formats ROI ratio", () => {
    expect(formatRoiRatio(45.3)).toBe("45:1");
    expect(formatRoiRatio(0)).toBe("—");
  });
});
