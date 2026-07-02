import { describe, expect, it } from "vitest";
import {
  buildWeeklyOwnerReport,
  formatWeeklyOwnerReportDigest,
  WEEKLY_RECOVERY_CASES_THRESHOLD,
  WEEKLY_STATION_DELAY_MIN_DAYS,
  WEEKLY_STATION_DELAY_THRESHOLD_MINUTES,
} from "@/lib/admin/build-weekly-owner-report";
import {
  buildDailyReport,
} from "@/lib/admin/build-daily-report";

function mockDailyReport(input: {
  date: string;
  productName: string;
  quantity: number;
  barDelay?: number | null;
  recoveryCases?: number;
  issues?: string[];
  orderCount?: number;
}) {
  return buildDailyReport({
    date: input.date,
    venueName: "Pilot",
    weekdayLabel: "Utorak",
    currencyLabel: "RSD",
    orders: Array.from({ length: input.orderCount ?? 10 }, (_, i) => ({
      id: `${input.date}-${i}`,
      total: 1000,
      created_at: `${input.date}T12:00:00.000Z`,
      session_id: null,
      guest_token: null,
    })),
    sessions: [],
    feedback: [],
    denisMetrics: {
      sessionsHandled: 5,
      upsellRevenue: 1200,
      upsellConversionRate: 0.1,
      proactiveNudgesSent: 10,
      nudgeAcceptRate: 0.2,
      avgResponseTime: 1200,
      creditsBurned: 20,
    },
    revenueYesterday: 8000,
    revenueLastWeekSameDay: 9000,
    prepTimeAvgMinutes: 12,
    slowestItem: { name: "Burger", avgMinutes: 15 },
    peakHour: "20:00",
    peakOrderCount: 12,
    returningGuestSessions: 2,
    newGuestSessions: 8,
    denisShift: {
      stationQuestions: [],
      staffNotifications: [],
      waiterCalls: [],
      stationStates: input.barDelay != null
        ? [
            {
              station: "bar" as const,
              in_prep_at: "2026-01-01T20:00:00.000Z",
              ready_at: "2026-01-01T20:20:00.000Z",
            },
          ]
        : [],
      tableNames: {},
      kitchenFallbackPrepMinutes: 12,
      serviceRecovery:
        input.recoveryCases != null
          ? {
              casesOpened: input.recoveryCases,
              resolved: 0,
              unresolved: input.recoveryCases,
              avgManagerResponseMinutes: null,
            }
          : undefined,
      busObligations:
        input.barDelay != null
          ? []
          : undefined,
    },
    productRollup: [
      {
        name: input.productName,
        quantity: input.quantity,
        revenue: input.quantity * 500,
      },
      { name: "Salata", quantity: 2, revenue: 1000 },
    ],
  });
}

describe("buildWeeklyOwnerReport", () => {
  it("rolls up stored daily reports without recomputing history", () => {
    const reports = [
      mockDailyReport({ date: "2026-06-23", productName: "Ćevapi", quantity: 20 }),
      mockDailyReport({ date: "2026-06-24", productName: "Ćevapi", quantity: 15 }),
      mockDailyReport({ date: "2026-06-25", productName: "Burger", quantity: 30 }),
    ];

    const weekly = buildWeeklyOwnerReport({
      reports,
      weekEnding: "2026-06-25",
    });

    expect(weekly.daysLoaded).toBe(3);
    expect(weekly.sections.topProducts[0]?.name).toBe("Ćevapi");
    expect(weekly.sections.topProducts[0]?.quantity).toBe(35);
    expect(weekly.sections.denisStats.upsellRevenue).toBe(3600);
  });

  it("quiet week headline without empty recommendation sections", () => {
    const reports = [
      mockDailyReport({ date: "2026-06-23", productName: "Pivo", quantity: 5 }),
      mockDailyReport({ date: "2026-06-24", productName: "Pivo", quantity: 4 }),
    ];

    const weekly = buildWeeklyOwnerReport({
      reports,
      weekEnding: "2026-06-24",
    });

    expect(weekly.isQuietWeek).toBe(true);
    expect(weekly.sections.headline).toContain("Mirna nedelja");
    expect(weekly.sections.recommendations).toEqual([]);

    const digest = formatWeeklyOwnerReportDigest(weekly);
    expect(digest.text).toContain("Mirna nedelja");
    expect(digest.text).not.toContain("TOP 5");
  });

  it("emits recommendations from documented thresholds", () => {
    const slowBarDays = Array.from({ length: WEEKLY_STATION_DELAY_MIN_DAYS }, (_, i) =>
      mockDailyReport({
        date: `2026-06-${20 + i}`,
        productName: "Pivo",
        quantity: 10,
        barDelay: WEEKLY_STATION_DELAY_THRESHOLD_MINUTES + 1,
        issues: ["Bar kasni"],
      })
    );
    slowBarDays.push(
      mockDailyReport({
        date: "2026-06-23",
        productName: "Pivo",
        quantity: 10,
        recoveryCases: WEEKLY_RECOVERY_CASES_THRESHOLD,
        issues: ["Recovery"],
      })
    );

    const weekly = buildWeeklyOwnerReport({
      reports: slowBarDays,
      weekEnding: "2026-06-23",
    });

    expect(weekly.isQuietWeek).toBe(false);
    expect(
      weekly.sections.recommendations.some((line) => line.includes("Bar kasni"))
    ).toBe(true);
    expect(
      weekly.sections.recommendations.some((line) =>
        line.includes(`${WEEKLY_RECOVERY_CASES_THRESHOLD} service recovery`)
      )
    ).toBe(true);
  });
});

describe("weekly rollup store-only contract", () => {
  it("weekly builder only consumes DailyReport[] snapshots", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const weeklySource = await fs.readFile(
      path.join(process.cwd(), "src/lib/admin/build-weekly-owner-report.ts"),
      "utf8"
    );
    const runSource = await fs.readFile(
      path.join(process.cwd(), "src/lib/admin/run-daily-report.ts"),
      "utf8"
    );
    expect(weeklySource).not.toContain("loadDailyReportForLocation");
    expect(runSource).toContain("loadStoredDailyReportsForRange");
    expect(runSource).toMatch(
      /deliverWeeklyOwnerReport[\s\S]*loadStoredDailyReportsForRange/
    );
  });
});
