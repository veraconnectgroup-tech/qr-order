import { describe, expect, it } from "vitest";
import { buildConversionFunnel } from "@/lib/analytics/admin-intelligence/conversion-funnel";
import { buildMenuPerformanceMatrix } from "@/lib/analytics/admin-intelligence/menu-matrix";
import { buildCompetitorBenchmark } from "@/lib/analytics/admin-intelligence/competitor-benchmark";
import { buildTimeAnalytics } from "@/lib/analytics/admin-intelligence/time-analytics";
import { buildDenisPerformanceSnapshot } from "@/lib/analytics/admin-intelligence/denis-performance";

describe("buildConversionFunnel", () => {
  it("computes correct step percentages and cart abandonment", () => {
    const funnel = buildConversionFunnel({
      scan_qr: 100,
      open_menu: 90,
      browse: 70,
      add_to_cart: 40,
      order: 25,
      pay: 20,
    });

    expect(funnel.steps[0]?.pctOfTotal).toBe(100);
    expect(funnel.steps[1]?.pctOfPrevious).toBe(90);
    expect(funnel.steps[3]?.dropOffPct).toBe(42.9);
    expect(funnel.cartAbandonmentRate).toBe(37.5);
    expect(funnel.biggestDropOffStage).toBe("add_to_cart");
  });
});

describe("buildMenuPerformanceMatrix", () => {
  it("ranks all items by revenue and flags boost candidates", () => {
    const matrix = buildMenuPerformanceMatrix({
      products: [
        { id: "p1", name: "Schnitzel", price: 25, prepTimeMinutes: 15 },
        { id: "p2", name: "Salat", price: 9, prepTimeMinutes: 5 },
        { id: "p3", name: "Truffle Pasta", price: 32, prepTimeMinutes: 18 },
      ],
      orderLines: [
        {
          productId: "p1",
          productName: "Schnitzel",
          quantity: 45,
          revenue: 1125,
          sessionId: "s1",
        },
        {
          productId: "p2",
          productName: "Salat",
          quantity: 20,
          revenue: 180,
          sessionId: "s2",
        },
        {
          productId: "p3",
          productName: "Truffle Pasta",
          quantity: 3,
          revenue: 96,
          sessionId: "s3",
        },
      ],
      satisfactionByProductId: { p1: 0.92 },
    });

    expect(matrix.items).toHaveLength(3);
    expect(matrix.items[0]?.name).toBe("Schnitzel");
    expect(matrix.items[0]?.rank).toBe(1);
    expect(matrix.items[0]?.orderCount).toBe(45);
    expect(matrix.items[0]?.revenue).toBe(1125);
    expect(matrix.items[0]?.prepTimeMinutes).toBe(15);
    expect(matrix.items[0]?.satisfactionPct).toBe(92);
    expect(matrix.boostCandidates.some((row) => row.productId === "p3")).toBe(
      true
    );
  });
});

describe("buildTimeAnalytics", () => {
  it("identifies busiest hours and staffing gaps", () => {
    const createdAt = new Date();
    createdAt.setHours(19, 30, 0, 0);

    const analytics = buildTimeAnalytics({
      orders: Array.from({ length: 12 }).map((_, index) => ({
        id: `o-${index}`,
        total: 30,
        status: "delivered",
        payment_status: "paid",
        payment_method: "online",
        order_source: "qr" as const,
        created_at: createdAt.toISOString(),
        order_items: [],
      })),
      from: new Date(Date.now() - 7 * 86_400_000),
      to: new Date(),
      currentWaiterCount: 2,
    });

    expect(analytics.busiestHours[0]?.hour).toBe("19:00");
    expect(analytics.staffSuggestions.length).toBeGreaterThan(0);
    expect(analytics.staffSuggestions[0]?.suggestedWaiters).toBeGreaterThan(2);
  });
});

describe("buildDenisPerformanceSnapshot", () => {
  it("aggregates upsell and handoff metrics", () => {
    const snapshot = buildDenisPerformanceSnapshot({
      sessionsCount: 50,
      sessionsWithOrder: 30,
      aiSessions: [
        { language: "de", messages: [{ role: "user" }] },
        { language: null, messages: [{ role: "user" }] },
      ],
      timelineEvents: [
        {
          event_type: "intent.resolved",
          payload: { intent: "HANDOFF_WAITER" },
          ai_session_id: "a1",
        },
      ],
      experienceRollup: {
        nudgeImpressions: 100,
        offerConversions: 20,
        byNudgeKind: { dessert_upsell: 60, drink_upsell: 40 },
        byOutcome: { accepted: 20 },
      },
      avgResponseMs: 850,
    });

    expect(snapshot.conversionRate).toBe(0.6);
    expect(snapshot.languageAccuracyPct).toBe(50);
    expect(snapshot.handoffRate).toBe(50);
    expect(snapshot.avgResponseMs).toBe(850);
    expect(snapshot.upsellByNudgeKind[0]?.kind).toBe("dessert_upsell");
  });
});

describe("buildCompetitorBenchmark", () => {
  it("compares venue metrics against industry averages", () => {
    const benchmark = buildCompetitorBenchmark({
      venueAvgTicket: 32,
      venueConversionRate: 0.65,
      venueCartAbandonmentRate: 35,
    });

    expect(benchmark.venueAvgTicket).toBe(32);
    expect(benchmark.ticketDeltaPct).toBeGreaterThan(0);
    expect(benchmark.summary.length).toBeGreaterThan(10);
  });
});
